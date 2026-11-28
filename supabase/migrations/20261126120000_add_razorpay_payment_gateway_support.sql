-- ==============================================================================
-- Migration: 20261126120000_add_razorpay_payment_gateway_support.sql
-- Cashfree -> Razorpay payment gateway migration (forward-only, additive).
--
-- NOT APPLIED TO ANY DATABASE BY THE AUTHORING SESSION. Apply to staging first.
--
-- What this does:
--   1. `provider` discriminator on payment_orders / payment_transactions /
--      payment_refunds. Existing rows are backfilled as 'cashfree' (every historical
--      payment went through Cashfree). The default is then dropped so new rows must
--      name their provider. No historical gateway ID, status or amount is rewritten.
--   2. Provider-scoped unique indexes on gateway identifiers (the original global
--      unique indexes are kept: they are strictly stronger).
--   3. payment_orders.receipt: stable internal reference sent to Razorpay as the order
--      `receipt` (max 40 chars, unique at Razorpay). The local row is written BEFORE
--      the Razorpay call so an order whose creation response was lost can be recovered
--      with GET /v1/orders?receipt=... instead of being created twice.
--   4. At most one live (created/attempted/paid) order per consultation.
--   5. Database-enforced financial invariants (triggers):
--        - amounts, currency, provider and parent links are immutable;
--        - gateway identifiers are set-once;
--        - order / transaction / refund statuses only move forward
--          (a captured payment can never regress to failed/authorized);
--        - financial rows cannot be deleted.
--   6. payment_refunds: idempotency key (Razorpay X-Refund-Idempotency), last error,
--      actor and request correlation.
--   7. webhook_events: lease-based retryable processing (attempts, locked_until,
--      updated_at) and terminal 'rejected' status. Fixes the legacy behaviour where an
--      event stuck in 'received' was acknowledged forever without reprocessing.
--   8. payment_issues: administrator action / reconciliation queue.
--   9. payment_notifications: durable, idempotent notification ledger.
--  10. payment_audit_log: append-only financial audit trail.
--  11. RPCs (SECURITY INVOKER, pinned search_path, service_role only):
--        - apply_payment_event: ONE transaction that records the provider payment,
--          advances the order monotonically and confirms the booking (or moves the
--          consultation to slot-conflict recovery). Shared by checkout verification,
--          webhooks, reconciliation and the legacy Cashfree webhook.
--        - claim_webhook_event: lease a webhook event for processing.
--        - create_payment_refund_intent: balance-checked refund intent under lock.
--        - rebook_conflicted_consultation: paid + slot-conflict -> replacement slot,
--          no second payment.
--        - claim_payment_notification: idempotent notification claim with lease.
--
-- RLS stays enabled everywhere; browser roles (anon, authenticated) get no table or
-- function privileges. No foreign key is removed.
--
-- Rollback (manual, only while NO Razorpay rows exist):
--   DROP FUNCTION apply_payment_event, claim_webhook_event, create_payment_refund_intent,
--   rebook_conflicted_consultation, claim_payment_notification and the guard trigger
--   functions; DROP TABLE payment_notifications, payment_issues, payment_audit_log.
--   The added columns are nullable/additive and can stay. Never drop `provider` once
--   Razorpay rows exist: it is the only way to tell the two providers' records apart.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Provider discriminators (backfill existing rows as historical Cashfree records)
-- ------------------------------------------------------------------------------
ALTER TABLE public.payment_orders
    ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'cashfree';
ALTER TABLE public.payment_orders ALTER COLUMN provider DROP DEFAULT;
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS chk_orders_provider;
ALTER TABLE public.payment_orders
    ADD CONSTRAINT chk_orders_provider CHECK (provider IN ('cashfree', 'razorpay'));

ALTER TABLE public.payment_transactions
    ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'cashfree';
ALTER TABLE public.payment_transactions ALTER COLUMN provider DROP DEFAULT;
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS chk_trans_provider;
ALTER TABLE public.payment_transactions
    ADD CONSTRAINT chk_trans_provider CHECK (provider IN ('cashfree', 'razorpay'));

ALTER TABLE public.payment_refunds
    ADD COLUMN IF NOT EXISTS provider VARCHAR(20) NOT NULL DEFAULT 'cashfree';
ALTER TABLE public.payment_refunds ALTER COLUMN provider DROP DEFAULT;
ALTER TABLE public.payment_refunds DROP CONSTRAINT IF EXISTS chk_refunds_provider;
ALTER TABLE public.payment_refunds
    ADD CONSTRAINT chk_refunds_provider CHECK (provider IN ('cashfree', 'razorpay'));

-- ------------------------------------------------------------------------------
-- 2. Provider-scoped gateway identifier uniqueness
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_gateway_order_id
    ON public.payment_orders (provider, gateway_order_id) WHERE gateway_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trans_provider_gateway_payment_id
    ON public.payment_transactions (provider, gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_provider_gateway_refund_id
    ON public.payment_refunds (provider, gateway_refund_id) WHERE gateway_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_provider_status
    ON public.payment_orders (provider, status, created_at);

-- ------------------------------------------------------------------------------
-- 3. Receipt and 4. one live order per consultation
-- ------------------------------------------------------------------------------
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS receipt VARCHAR(40) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_receipt
    ON public.payment_orders (receipt) WHERE receipt IS NOT NULL;

-- Historical Cashfree data already satisfies this: Cashfree order IDs were derived
-- deterministically from the consultation ID and are globally unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_live_per_consultation
    ON public.payment_orders (consultation_id) WHERE status IN ('created', 'attempted', 'paid');

-- ------------------------------------------------------------------------------
-- 6. Refund idempotency, actor and correlation
-- ------------------------------------------------------------------------------
ALTER TABLE public.payment_refunds ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) NULL;
ALTER TABLE public.payment_refunds ADD COLUMN IF NOT EXISTS last_error TEXT NULL;
ALTER TABLE public.payment_refunds ADD COLUMN IF NOT EXISTS requested_by VARCHAR(100) NULL;
ALTER TABLE public.payment_refunds ADD COLUMN IF NOT EXISTS request_id VARCHAR(64) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_idempotency_key
    ON public.payment_refunds (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_open ON public.payment_refunds (created_at)
    WHERE status IN ('pending', 'initiated');

-- ------------------------------------------------------------------------------
-- 7. Retryable webhook processing
-- ------------------------------------------------------------------------------
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL;
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS chk_webhook_status;
ALTER TABLE public.webhook_events
    ADD CONSTRAINT chk_webhook_status CHECK (status IN ('received', 'processed', 'ignored', 'failed', 'rejected'));
CREATE INDEX IF NOT EXISTS idx_webhook_retryable
    ON public.webhook_events (created_at) WHERE status IN ('received', 'failed');

DROP TRIGGER IF EXISTS set_webhook_events_updated_at ON public.webhook_events;
CREATE TRIGGER set_webhook_events_updated_at
    BEFORE UPDATE ON public.webhook_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 8. Payment issues (administrator / reconciliation queue)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(20) NOT NULL,
    payment_order_id UUID NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
    consultation_id UUID NULL REFERENCES public.consultations(id) ON DELETE RESTRICT,
    kind VARCHAR(40) NOT NULL,
    gateway_reference VARCHAR(100) NULL,
    detail TEXT NULL,
    resolved_at TIMESTAMPTZ NULL,
    resolved_by VARCHAR(100) NULL,
    resolution_note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_issues_provider CHECK (provider IN ('cashfree', 'razorpay')),
    CONSTRAINT chk_issues_kind CHECK (kind IN (
        'slot_conflict',
        'amount_mismatch',
        'currency_mismatch',
        'duplicate_payment',
        'authorized_not_captured',
        'paid_inactive_consultation',
        'unknown_gateway_order',
        'order_creation_unknown',
        'refund_failed',
        'refund_manual_review',
        'untracked_refund',
        'webhook_retries_exhausted',
        'notification_failed',
        'reconciliation_error'
    ))
);

-- One OPEN issue per (kind, order, gateway reference); resolved issues are kept for audit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_open_unique
    ON public.payment_issues (kind, COALESCE(payment_order_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(gateway_reference, ''))
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_issues_open ON public.payment_issues (created_at) WHERE resolved_at IS NULL;

DROP TRIGGER IF EXISTS set_payment_issues_updated_at ON public.payment_issues;
CREATE TRIGGER set_payment_issues_updated_at
    BEFORE UPDATE ON public.payment_issues
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.payment_issues ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 9. Notification ledger (exactly-once claim per dedupe key, retryable)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dedupe_key VARCHAR(160) NOT NULL,
    kind VARCHAR(40) NOT NULL,
    consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE RESTRICT,
    payment_order_id UUID NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
    refund_id UUID NULL REFERENCES public.payment_refunds(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    last_error TEXT NULL,
    provider_message_id VARCHAR(200) NULL,
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_notifications_status CHECK (status IN ('pending', 'sent', 'failed')),
    CONSTRAINT chk_notifications_kind CHECK (kind IN (
        'payment_receipt',
        'booking_confirmed',
        'slot_conflict_action_required',
        'rescheduled',
        'refund_processing',
        'refund_processed'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON public.payment_notifications (dedupe_key);
CREATE INDEX IF NOT EXISTS idx_notifications_retryable
    ON public.payment_notifications (created_at) WHERE status IN ('pending', 'failed');

DROP TRIGGER IF EXISTS set_payment_notifications_updated_at ON public.payment_notifications;
CREATE TRIGGER set_payment_notifications_updated_at
    BEFORE UPDATE ON public.payment_notifications
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 10. Append-only financial audit log
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type VARCHAR(20) NOT NULL,
    actor_id VARCHAR(100) NULL,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    entity_id UUID NULL,
    old_state VARCHAR(60) NULL,
    new_state VARCHAR(60) NULL,
    reason TEXT NULL,
    request_id VARCHAR(64) NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_audit_actor_type CHECK (actor_type IN ('admin', 'system', 'customer', 'provider'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.payment_audit_log (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.payment_audit_log (created_at DESC);

ALTER TABLE public.payment_audit_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Browser roles get nothing on financial tables (RLS already denies; this is
-- defense in depth against a future permissive policy).
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.payment_orders, public.payment_transactions, public.payment_refunds,
    public.webhook_events, public.payment_issues, public.payment_notifications,
    public.payment_audit_log FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. Database-enforced financial invariants
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_payment_order_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.amount_in_paise IS DISTINCT FROM OLD.amount_in_paise
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.consultation_id IS DISTINCT FROM OLD.consultation_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.receipt IS DISTINCT FROM OLD.receipt THEN
        RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_FIELD' USING ERRCODE = 'P0001';
    END IF;

    IF OLD.gateway_order_id IS NOT NULL AND NEW.gateway_order_id IS DISTINCT FROM OLD.gateway_order_id THEN
        RAISE EXCEPTION 'GATEWAY_ID_SET_ONCE' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status = 'created'   AND NEW.status IN ('attempted', 'paid', 'failed', 'expired')) OR
        (OLD.status = 'attempted' AND NEW.status IN ('paid', 'failed', 'expired')) OR
        -- Late captures are accepted: money received must always be recorded.
        (OLD.status IN ('failed', 'expired') AND NEW.status = 'paid')
    ) THEN
        RAISE EXCEPTION 'ILLEGAL_ORDER_TRANSITION % -> %', OLD.status, NEW.status USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_payment_orders_update ON public.payment_orders;
CREATE TRIGGER guard_payment_orders_update
    BEFORE UPDATE ON public.payment_orders
    FOR EACH ROW EXECUTE FUNCTION public.guard_payment_order_update();

CREATE OR REPLACE FUNCTION public.guard_payment_transaction_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.amount_in_paise IS DISTINCT FROM OLD.amount_in_paise
       OR NEW.payment_order_id IS DISTINCT FROM OLD.payment_order_id
       OR NEW.provider IS DISTINCT FROM OLD.provider THEN
        RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_FIELD' USING ERRCODE = 'P0001';
    END IF;

    IF OLD.gateway_payment_id IS NOT NULL AND NEW.gateway_payment_id IS DISTINCT FROM OLD.gateway_payment_id THEN
        RAISE EXCEPTION 'GATEWAY_ID_SET_ONCE' USING ERRCODE = 'P0001';
    END IF;

    -- 'success' (captured) is terminal; 'failed' -> 'success' is allowed because
    -- providers document out-of-order failed-then-captured deliveries.
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status = 'pending'      AND NEW.status IN ('success', 'failed', 'user_dropped')) OR
        (OLD.status = 'user_dropped' AND NEW.status IN ('success', 'failed', 'pending')) OR
        (OLD.status = 'failed'       AND NEW.status = 'success')
    ) THEN
        RAISE EXCEPTION 'ILLEGAL_TRANSACTION_TRANSITION % -> %', OLD.status, NEW.status USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_payment_transactions_update ON public.payment_transactions;
CREATE TRIGGER guard_payment_transactions_update
    BEFORE UPDATE ON public.payment_transactions
    FOR EACH ROW EXECUTE FUNCTION public.guard_payment_transaction_update();

CREATE OR REPLACE FUNCTION public.guard_payment_refund_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.amount_in_paise IS DISTINCT FROM OLD.amount_in_paise
       OR NEW.payment_order_id IS DISTINCT FROM OLD.payment_order_id
       OR NEW.payment_transaction_id IS DISTINCT FROM OLD.payment_transaction_id
       OR NEW.provider IS DISTINCT FROM OLD.provider
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
        RAISE EXCEPTION 'IMMUTABLE_FINANCIAL_FIELD' USING ERRCODE = 'P0001';
    END IF;

    IF OLD.gateway_refund_id IS NOT NULL AND NEW.gateway_refund_id IS DISTINCT FROM OLD.gateway_refund_id THEN
        RAISE EXCEPTION 'GATEWAY_ID_SET_ONCE' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
        (OLD.status = 'pending'   AND NEW.status IN ('initiated', 'succeeded', 'failed')) OR
        (OLD.status = 'initiated' AND NEW.status IN ('succeeded', 'failed'))
    ) THEN
        RAISE EXCEPTION 'ILLEGAL_REFUND_TRANSITION % -> %', OLD.status, NEW.status USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_payment_refunds_update ON public.payment_refunds;
CREATE TRIGGER guard_payment_refunds_update
    BEFORE UPDATE ON public.payment_refunds
    FOR EACH ROW EXECUTE FUNCTION public.guard_payment_refund_update();

CREATE OR REPLACE FUNCTION public.forbid_financial_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'FINANCIAL_HISTORY_IS_IMMUTABLE (%)', TG_TABLE_NAME USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS forbid_payment_orders_delete ON public.payment_orders;
CREATE TRIGGER forbid_payment_orders_delete BEFORE DELETE ON public.payment_orders
    FOR EACH ROW EXECUTE FUNCTION public.forbid_financial_delete();
DROP TRIGGER IF EXISTS forbid_payment_transactions_delete ON public.payment_transactions;
CREATE TRIGGER forbid_payment_transactions_delete BEFORE DELETE ON public.payment_transactions
    FOR EACH ROW EXECUTE FUNCTION public.forbid_financial_delete();
DROP TRIGGER IF EXISTS forbid_payment_refunds_delete ON public.payment_refunds;
CREATE TRIGGER forbid_payment_refunds_delete BEFORE DELETE ON public.payment_refunds
    FOR EACH ROW EXECUTE FUNCTION public.forbid_financial_delete();

-- Audit log: append-only (no UPDATE, no DELETE) through normal operations.
CREATE OR REPLACE FUNCTION public.forbid_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'AUDIT_LOG_IS_APPEND_ONLY' USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS forbid_payment_audit_log_mutation ON public.payment_audit_log;
CREATE TRIGGER forbid_payment_audit_log_mutation BEFORE UPDATE OR DELETE ON public.payment_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.forbid_audit_mutation();

REVOKE ALL ON FUNCTION public.guard_payment_order_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_payment_transaction_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_payment_refund_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.forbid_financial_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.forbid_audit_mutation() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 11a. apply_payment_event: the single atomic payment + booking coordinator.
--
-- p_status: 'authorized' | 'captured' | 'failed' | 'user_dropped'
-- Returns jsonb { outcome, payment_order_id, consultation_id, transaction_id, order_status }
-- outcome: order_not_found | amount_mismatch | currency_mismatch | payment_pending |
--          payment_failed | user_dropped | confirmed | already_confirmed |
--          slot_conflict | duplicate_payment | paid_inactive_consultation
--
-- Concurrency: the order row is locked first (FOR UPDATE), then the consultation row,
-- so checkout callback, webhook and reconciliation serialize per order.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_payment_event(
    p_payment_order_id UUID,
    p_gateway_payment_id VARCHAR(100),
    p_status VARCHAR(20),
    p_amount_in_paise BIGINT,
    p_currency VARCHAR(3),
    p_payment_method VARCHAR(50) DEFAULT NULL,
    p_bank_reference VARCHAR(100) DEFAULT NULL,
    p_error_code VARCHAR(50) DEFAULT NULL,
    p_error_description TEXT DEFAULT NULL,
    p_event_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_order public.payment_orders;
    v_txn public.payment_transactions;
    v_consultation public.consultations;
    v_target VARCHAR(20);
    v_slot_id UUID;
    v_other_success INT;
BEGIN
    IF p_status NOT IN ('authorized', 'captured', 'failed', 'user_dropped') THEN
        RAISE EXCEPTION 'INVALID_PAYMENT_STATUS %', p_status USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_order FROM public.payment_orders WHERE id = p_payment_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'order_not_found');
    END IF;

    IF p_currency IS DISTINCT FROM v_order.currency THEN
        INSERT INTO public.payment_issues (provider, payment_order_id, consultation_id, kind, gateway_reference, detail)
        VALUES (v_order.provider, v_order.id, v_order.consultation_id, 'currency_mismatch', p_gateway_payment_id,
                format('expected %s, received %s (status %s)', v_order.currency, p_currency, p_status))
        ON CONFLICT DO NOTHING;
        RETURN jsonb_build_object('outcome', 'currency_mismatch', 'payment_order_id', v_order.id,
                                  'consultation_id', v_order.consultation_id, 'order_status', v_order.status);
    END IF;

    IF p_amount_in_paise IS DISTINCT FROM v_order.amount_in_paise THEN
        INSERT INTO public.payment_issues (provider, payment_order_id, consultation_id, kind, gateway_reference, detail)
        VALUES (v_order.provider, v_order.id, v_order.consultation_id, 'amount_mismatch', p_gateway_payment_id,
                format('expected %s paise, received %s paise (status %s)', v_order.amount_in_paise, p_amount_in_paise, p_status))
        ON CONFLICT DO NOTHING;
        RETURN jsonb_build_object('outcome', 'amount_mismatch', 'payment_order_id', v_order.id,
                                  'consultation_id', v_order.consultation_id, 'order_status', v_order.status);
    END IF;

    v_target := CASE p_status
        WHEN 'authorized' THEN 'pending'
        WHEN 'captured' THEN 'success'
        WHEN 'failed' THEN 'failed'
        ELSE 'user_dropped'
    END;

    -- Record / advance the provider payment monotonically.
    IF p_gateway_payment_id IS NOT NULL THEN
        SELECT * INTO v_txn FROM public.payment_transactions
        WHERE provider = v_order.provider AND gateway_payment_id = p_gateway_payment_id
        FOR UPDATE;
    END IF;

    IF v_txn.id IS NULL THEN
        INSERT INTO public.payment_transactions (
            payment_order_id, provider, gateway_payment_id, amount_in_paise, status,
            payment_method, bank_reference, error_code, error_description
        ) VALUES (
            v_order.id, v_order.provider, p_gateway_payment_id, p_amount_in_paise, v_target,
            p_payment_method, p_bank_reference, p_error_code, p_error_description
        )
        RETURNING * INTO v_txn;
    ELSIF v_txn.payment_order_id <> v_order.id THEN
        RAISE EXCEPTION 'PAYMENT_BELONGS_TO_ANOTHER_ORDER' USING ERRCODE = 'P0001';
    ELSIF v_txn.status <> v_target AND (
        (v_txn.status = 'pending'      AND v_target IN ('success', 'failed', 'user_dropped')) OR
        (v_txn.status = 'user_dropped' AND v_target IN ('success', 'failed', 'pending')) OR
        (v_txn.status = 'failed'       AND v_target = 'success')
    ) THEN
        UPDATE public.payment_transactions
        SET status = v_target,
            payment_method = COALESCE(p_payment_method, payment_method),
            bank_reference = COALESCE(p_bank_reference, bank_reference),
            error_code = CASE WHEN v_target = 'success' THEN NULL ELSE COALESCE(p_error_code, error_code) END,
            error_description = CASE WHEN v_target = 'success' THEN NULL ELSE COALESCE(p_error_description, error_description) END
        WHERE id = v_txn.id
        RETURNING * INTO v_txn;
    END IF;
    -- Otherwise the event is stale/out-of-order and is ignored (e.g. failed after captured).

    IF v_txn.status <> 'success' THEN
        IF v_order.status = 'created' THEN
            UPDATE public.payment_orders SET status = 'attempted' WHERE id = v_order.id RETURNING * INTO v_order;
        END IF;
        RETURN jsonb_build_object(
            'outcome', CASE v_txn.status WHEN 'pending' THEN 'payment_pending'
                                         WHEN 'failed' THEN 'payment_failed'
                                         ELSE 'user_dropped' END,
            'payment_order_id', v_order.id, 'consultation_id', v_order.consultation_id,
            'transaction_id', v_txn.id, 'order_status', v_order.status);
    END IF;

    -- Captured. A second, different captured payment on an already-paid order is
    -- money received twice: keep it, flag it, never overwrite history.
    SELECT count(*) INTO v_other_success FROM public.payment_transactions
    WHERE payment_order_id = v_order.id AND status = 'success' AND id <> v_txn.id;

    IF v_other_success > 0 THEN
        INSERT INTO public.payment_issues (provider, payment_order_id, consultation_id, kind, gateway_reference, detail)
        VALUES (v_order.provider, v_order.id, v_order.consultation_id, 'duplicate_payment', p_gateway_payment_id,
                'additional captured payment on an already-paid order')
        ON CONFLICT DO NOTHING;
        RETURN jsonb_build_object('outcome', 'duplicate_payment', 'payment_order_id', v_order.id,
                                  'consultation_id', v_order.consultation_id, 'transaction_id', v_txn.id,
                                  'order_status', v_order.status);
    END IF;

    IF v_order.status <> 'paid' THEN
        UPDATE public.payment_orders
        SET status = 'paid', paid_at = COALESCE(p_event_time, now())
        WHERE id = v_order.id
        RETURNING * INTO v_order;
    END IF;

    SELECT * INTO v_consultation FROM public.consultations WHERE id = v_order.consultation_id FOR UPDATE;

    IF v_consultation.status = 'confirmed' THEN
        RETURN jsonb_build_object('outcome', 'already_confirmed', 'payment_order_id', v_order.id,
                                  'consultation_id', v_consultation.id, 'transaction_id', v_txn.id,
                                  'order_status', v_order.status);
    END IF;

    IF v_consultation.status = 'slot_conflict_pending_reschedule' THEN
        RETURN jsonb_build_object('outcome', 'slot_conflict', 'payment_order_id', v_order.id,
                                  'consultation_id', v_consultation.id, 'transaction_id', v_txn.id,
                                  'order_status', v_order.status);
    END IF;

    IF v_consultation.status IN ('slot_held', 'awaiting_payment')
       AND v_consultation.slot_id IS NOT NULL
       AND v_order.reservation_token IS NOT NULL THEN
        -- Honour the hold if nobody else has taken the slot, even if the 15-minute
        -- window lapsed (same rule as 20261006120000_relax_confirm_consultation_slot_expiry).
        UPDATE public.consultation_slots
        SET status = 'booked', reservation_token = NULL, reserved_until = NULL, updated_at = now()
        WHERE id = v_consultation.slot_id
          AND status = 'reserved'
          AND reservation_token = v_order.reservation_token
        RETURNING id INTO v_slot_id;

        IF v_slot_id IS NOT NULL THEN
            UPDATE public.consultations SET status = 'confirmed', updated_at = now()
            WHERE id = v_consultation.id;
            RETURN jsonb_build_object('outcome', 'confirmed', 'payment_order_id', v_order.id,
                                      'consultation_id', v_consultation.id, 'transaction_id', v_txn.id,
                                      'order_status', v_order.status);
        END IF;
    END IF;

    IF v_consultation.status IN ('draft', 'slot_held', 'awaiting_payment') THEN
        -- LOCKED RULE: payment stays paid, booking is NOT confirmed, customer picks a
        -- replacement slot without paying again. No automatic refund.
        UPDATE public.consultations SET status = 'slot_conflict_pending_reschedule', updated_at = now()
        WHERE id = v_consultation.id;
        INSERT INTO public.payment_issues (provider, payment_order_id, consultation_id, kind, gateway_reference, detail)
        VALUES (v_order.provider, v_order.id, v_consultation.id, 'slot_conflict', p_gateway_payment_id,
                'paid but the reserved slot could not be honoured; awaiting replacement slot')
        ON CONFLICT DO NOTHING;
        RETURN jsonb_build_object('outcome', 'slot_conflict', 'payment_order_id', v_order.id,
                                  'consultation_id', v_consultation.id, 'transaction_id', v_txn.id,
                                  'order_status', v_order.status);
    END IF;

    INSERT INTO public.payment_issues (provider, payment_order_id, consultation_id, kind, gateway_reference, detail)
    VALUES (v_order.provider, v_order.id, v_consultation.id, 'paid_inactive_consultation', p_gateway_payment_id,
            format('captured payment for consultation in status %s', v_consultation.status))
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('outcome', 'paid_inactive_consultation', 'payment_order_id', v_order.id,
                              'consultation_id', v_consultation.id, 'transaction_id', v_txn.id,
                              'order_status', v_order.status);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_payment_event(UUID, VARCHAR, VARCHAR, BIGINT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_event(UUID, VARCHAR, VARCHAR, BIGINT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, TIMESTAMPTZ) TO service_role;

-- ------------------------------------------------------------------------------
-- 11b. Lease a webhook event for processing. Returns the claimed row, or a row of
-- NULLs when the event is terminal, currently leased by another worker, or out of
-- attempts.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_webhook_event(
    p_id UUID,
    p_lease_seconds INT DEFAULT 60,
    p_max_attempts INT DEFAULT 10
)
RETURNS public.webhook_events
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_event public.webhook_events;
BEGIN
    UPDATE public.webhook_events
    SET attempts = attempts + 1,
        locked_until = now() + make_interval(secs => p_lease_seconds)
    WHERE id = p_id
      AND status IN ('received', 'failed')
      AND (locked_until IS NULL OR locked_until < now())
      AND attempts < p_max_attempts
    RETURNING * INTO v_event;

    RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_event(UUID, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_event(UUID, INT, INT) TO service_role;

-- ------------------------------------------------------------------------------
-- 11c. Atomic refund intent. Locks the payment order, re-checks the refundable
-- balance of the captured transaction (every non-failed refund counts against it),
-- inserts a 'pending' refund and an audit row. Replaying the same idempotency key
-- returns the existing row. Raises ORDER_NOT_FOUND / ORDER_NOT_PAID /
-- TRANSACTION_NOT_REFUNDABLE / REFUND_EXCEEDS_BALANCE.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_payment_refund_intent(UUID, UUID, BIGINT, VARCHAR, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION public.create_payment_refund_intent(
    p_payment_order_id UUID,
    p_payment_transaction_id UUID,
    p_amount_in_paise BIGINT,
    p_reason VARCHAR(100),
    p_initiated_by VARCHAR(20),
    p_idempotency_key VARCHAR(64),
    p_requested_by VARCHAR(100),
    p_request_id VARCHAR(64)
)
RETURNS public.payment_refunds
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_order public.payment_orders;
    v_txn public.payment_transactions;
    v_existing public.payment_refunds;
    v_committed BIGINT;
    v_refund public.payment_refunds;
BEGIN
    SELECT * INTO v_order FROM public.payment_orders WHERE id = p_payment_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_existing FROM public.payment_refunds WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        RETURN v_existing;
    END IF;

    IF v_order.status <> 'paid' THEN
        RAISE EXCEPTION 'ORDER_NOT_PAID' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_txn FROM public.payment_transactions
    WHERE id = p_payment_transaction_id AND payment_order_id = p_payment_order_id;
    IF NOT FOUND OR v_txn.status <> 'success' OR v_txn.gateway_payment_id IS NULL THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_REFUNDABLE' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(SUM(amount_in_paise), 0) INTO v_committed
    FROM public.payment_refunds
    WHERE payment_transaction_id = p_payment_transaction_id
      AND status <> 'failed';

    IF p_amount_in_paise <= 0 OR v_committed + p_amount_in_paise > v_txn.amount_in_paise THEN
        RAISE EXCEPTION 'REFUND_EXCEEDS_BALANCE' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.payment_refunds (
        payment_order_id, payment_transaction_id, consultation_id, provider,
        amount_in_paise, status, reason, initiated_by, idempotency_key, requested_by, request_id
    ) VALUES (
        p_payment_order_id, p_payment_transaction_id, v_order.consultation_id, v_order.provider,
        p_amount_in_paise, 'pending', p_reason, p_initiated_by, p_idempotency_key, p_requested_by, p_request_id
    )
    RETURNING * INTO v_refund;

    INSERT INTO public.payment_audit_log (actor_type, actor_id, action, entity_type, entity_id,
                                          old_state, new_state, reason, request_id, metadata)
    VALUES (CASE WHEN p_initiated_by = 'admin' THEN 'admin' ELSE 'system' END, p_requested_by,
            'refund_requested', 'refund', v_refund.id, NULL, 'pending', p_reason, p_request_id,
            jsonb_build_object('payment_order_id', p_payment_order_id, 'amount_in_paise', p_amount_in_paise,
                               'refunded_before_paise', v_committed));

    RETURN v_refund;
END;
$$;

REVOKE ALL ON FUNCTION public.create_payment_refund_intent(UUID, UUID, BIGINT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_refund_intent(UUID, UUID, BIGINT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO service_role;

-- ------------------------------------------------------------------------------
-- 11d. Paid + slot-conflict -> replacement slot (no second payment).
-- Claims the new slot and confirms the consultation in one transaction.
-- Returns: rebooked | not_found | not_in_conflict | not_paid | slot_unavailable
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebook_conflicted_consultation(
    p_consultation_id UUID,
    p_new_slot_id UUID,
    p_min_lead_hours INT DEFAULT 24,
    p_horizon_days INT DEFAULT 30
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_consultation public.consultations;
    v_paid_order UUID;
    v_slot_id UUID;
BEGIN
    SELECT * INTO v_consultation FROM public.consultations WHERE id = p_consultation_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN 'not_found';
    END IF;

    IF v_consultation.status <> 'slot_conflict_pending_reschedule' THEN
        RETURN 'not_in_conflict';
    END IF;

    SELECT id INTO v_paid_order FROM public.payment_orders
    WHERE consultation_id = p_consultation_id AND status = 'paid'
    LIMIT 1;
    IF v_paid_order IS NULL THEN
        RETURN 'not_paid';
    END IF;

    UPDATE public.consultation_slots
    SET status = 'booked', reservation_token = NULL, reserved_until = NULL, updated_at = now()
    WHERE id = p_new_slot_id
      AND (status = 'available' OR (status = 'reserved' AND reserved_until < now()))
      AND start_time >= now() + make_interval(hours => p_min_lead_hours)
      AND start_time <= now() + make_interval(days => p_horizon_days)
    RETURNING id INTO v_slot_id;

    IF v_slot_id IS NULL THEN
        RETURN 'slot_unavailable';
    END IF;

    UPDATE public.consultations
    SET slot_id = v_slot_id, status = 'confirmed',
        reschedule_count = reschedule_count + 1, updated_at = now()
    WHERE id = p_consultation_id;

    UPDATE public.payment_issues
    SET resolved_at = now(), resolved_by = 'customer', resolution_note = 'replacement slot selected'
    WHERE consultation_id = p_consultation_id AND kind = 'slot_conflict' AND resolved_at IS NULL;

    INSERT INTO public.payment_audit_log (actor_type, action, entity_type, entity_id, old_state, new_state, metadata)
    VALUES ('customer', 'slot_conflict_rebooked', 'consultation', p_consultation_id,
            'slot_conflict_pending_reschedule', 'confirmed',
            jsonb_build_object('previous_slot_id', v_consultation.slot_id, 'new_slot_id', v_slot_id,
                               'payment_order_id', v_paid_order));

    RETURN 'rebooked';
END;
$$;

REVOKE ALL ON FUNCTION public.rebook_conflicted_consultation(UUID, UUID, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebook_conflicted_consultation(UUID, UUID, INT, INT) TO service_role;

-- ------------------------------------------------------------------------------
-- 11e. Idempotent notification claim with a retry lease. Creates the ledger row on
-- first use; returns the row when this caller may send now, or a row of NULLs when
-- it was already sent, is leased elsewhere, or is out of attempts.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_payment_notification(
    p_dedupe_key VARCHAR(160),
    p_kind VARCHAR(40),
    p_consultation_id UUID,
    p_payment_order_id UUID DEFAULT NULL,
    p_refund_id UUID DEFAULT NULL,
    p_lease_seconds INT DEFAULT 120,
    p_max_attempts INT DEFAULT 8
)
RETURNS public.payment_notifications
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_row public.payment_notifications;
BEGIN
    INSERT INTO public.payment_notifications (dedupe_key, kind, consultation_id, payment_order_id, refund_id)
    VALUES (p_dedupe_key, p_kind, p_consultation_id, p_payment_order_id, p_refund_id)
    ON CONFLICT (dedupe_key) DO NOTHING;

    UPDATE public.payment_notifications
    SET attempts = attempts + 1,
        locked_until = now() + make_interval(secs => p_lease_seconds)
    WHERE dedupe_key = p_dedupe_key
      AND status IN ('pending', 'failed')
      AND (locked_until IS NULL OR locked_until < now())
      AND attempts < p_max_attempts
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payment_notification(VARCHAR, VARCHAR, UUID, UUID, UUID, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_payment_notification(VARCHAR, VARCHAR, UUID, UUID, UUID, INT, INT) TO service_role;

-- The superseded two-step helper from the earlier draft must not linger.
DROP FUNCTION IF EXISTS public.confirm_consultation_booking(UUID, VARCHAR);
