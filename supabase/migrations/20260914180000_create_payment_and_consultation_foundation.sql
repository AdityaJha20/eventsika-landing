-- ==============================================================================
-- Eventsika Payment & Consultation Foundation Migration (Step 1)
-- Tables: consultation_slots, consultations, payment_orders,
--         payment_transactions, payment_refunds, webhook_events
-- Security: Row Level Security (RLS) enabled (Anon: DENIED, Backend Service: BYPASS)
-- Constraints: Strict integer paise, valid states, nullable provider IDs,
--              zero pricing defaults in database, duration = 60 mins.
-- ==============================================================================

-- 1. Consultation Slots Table (Inventory Foundation)
CREATE TABLE IF NOT EXISTS public.consultation_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available',
    reserved_until TIMESTAMPTZ NULL,
    reservation_token VARCHAR(64) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_slots_time_order CHECK (end_time > start_time),
    CONSTRAINT chk_slots_duration CHECK (end_time = start_time + interval '60 minutes'),
    CONSTRAINT chk_slots_status CHECK (status IN ('available', 'reserved', 'booked', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_slots_range ON public.consultation_slots (start_time, end_time);


-- 2. Consultations Table (Service Domain)
-- slot_id is nullable: a consultation draft can exist before a slot is reserved.
CREATE TABLE IF NOT EXISTS public.consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID NULL REFERENCES public.consultation_slots(id) ON DELETE RESTRICT,
    
    -- Customer Information (Denormalized Snapshot)
    customer_first_name VARCHAR(60) NOT NULL,
    customer_last_name VARCHAR(60) NOT NULL,
    customer_phone VARCHAR(15) NOT NULL,
    customer_email VARCHAR(150) NOT NULL,
    customer_city VARCHAR(100) NOT NULL,
    
    -- Event & Consultation Specifications
    event_type VARCHAR(50) NOT NULL,
    event_type_other VARCHAR(100) NULL,
    guest_count VARCHAR(50) NULL,
    event_date_approx VARCHAR(50) NULL,
    meeting_channel VARCHAR(20) NOT NULL,
    
    -- Lifecycle & State
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    cancellation_reason TEXT NULL,
    rescheduled_from_id UUID NULL REFERENCES public.consultations(id) ON DELETE SET NULL,
    reschedule_count SMALLINT NOT NULL DEFAULT 0,
    
    -- Correlation Tracking
    request_id VARCHAR(64) NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Data Integrity Constraints
    CONSTRAINT chk_consultations_first_name CHECK (char_length(customer_first_name) > 0 AND char_length(customer_first_name) <= 60),
    CONSTRAINT chk_consultations_last_name CHECK (char_length(customer_last_name) > 0 AND char_length(customer_last_name) <= 60),
    CONSTRAINT chk_consultations_phone CHECK (char_length(customer_phone) >= 10 AND char_length(customer_phone) <= 15),
    CONSTRAINT chk_consultations_email CHECK (char_length(customer_email) >= 5 AND char_length(customer_email) <= 150),
    CONSTRAINT chk_consultations_city CHECK (char_length(customer_city) > 0 AND char_length(customer_city) <= 100),
    CONSTRAINT chk_consultations_channel CHECK (meeting_channel IN ('phone', 'video')),
    CONSTRAINT chk_consultations_reschedule_count CHECK (reschedule_count >= 0),
    CONSTRAINT chk_consultations_status CHECK (
        status IN (
            'draft',
            'slot_held',
            'awaiting_payment',
            'confirmed',
            'slot_conflict_pending_reschedule',
            'rescheduled',
            'completed',
            'cancelled_customer',
            'cancelled_eventsika',
            'no_show'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_consultations_slot ON public.consultations (slot_id) WHERE slot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consultations_phone ON public.consultations (customer_phone);
CREATE INDEX IF NOT EXISTS idx_consultations_email ON public.consultations (customer_email);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON public.consultations (created_at DESC);


-- 3. Payment Orders Table (Internal Payment Intent)
-- gateway_order_id is nullable: internal order can exist before external provider order.
-- amount_in_paise has no default: pricing authority is server domain, not database default.
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE RESTRICT,
    gateway_order_id VARCHAR(100) NULL,
    amount_in_paise BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'created',
    expires_at TIMESTAMPTZ NULL,
    paid_at TIMESTAMPTZ NULL,
    request_id VARCHAR(64) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_orders_amount_positive CHECK (amount_in_paise > 0),
    CONSTRAINT chk_orders_currency CHECK (currency = 'INR'),
    CONSTRAINT chk_orders_status CHECK (status IN ('created', 'attempted', 'paid', 'failed', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_gateway_order_id ON public.payment_orders (gateway_order_id) WHERE gateway_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_consultation ON public.payment_orders (consultation_id);


-- 4. Payment Transactions Table (Immutable Attempt Ledger)
-- gateway_payment_id is nullable until reported by provider.
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
    gateway_payment_id VARCHAR(100) NULL,
    amount_in_paise BIGINT NOT NULL,
    fee_in_paise BIGINT NULL,
    tax_in_paise BIGINT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50) NULL,
    bank_reference VARCHAR(100) NULL,
    error_code VARCHAR(50) NULL,
    error_description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_trans_amount_positive CHECK (amount_in_paise > 0),
    CONSTRAINT chk_trans_status CHECK (status IN ('pending', 'success', 'failed', 'user_dropped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trans_gateway_payment_id ON public.payment_transactions (gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trans_order_id ON public.payment_transactions (payment_order_id);


-- 5. Payment Refunds Table (Reversals & Policy Compliance)
-- gateway_refund_id is nullable until created with provider.
CREATE TABLE IF NOT EXISTS public.payment_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_order_id UUID NOT NULL REFERENCES public.payment_orders(id) ON DELETE RESTRICT,
    payment_transaction_id UUID NULL REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
    consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE RESTRICT,
    gateway_refund_id VARCHAR(100) NULL,
    amount_in_paise BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reason VARCHAR(100) NOT NULL,
    initiated_by VARCHAR(20) NOT NULL,
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_refunds_amount_positive CHECK (amount_in_paise > 0),
    CONSTRAINT chk_refunds_status CHECK (status IN ('pending', 'initiated', 'succeeded', 'failed')),
    CONSTRAINT chk_refunds_initiated_by CHECK (initiated_by IN ('customer', 'admin', 'system_conflict'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_gateway_refund_id ON public.payment_refunds (gateway_refund_id) WHERE gateway_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.payment_refunds (payment_order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_consultation_id ON public.payment_refunds (consultation_id);


-- 6. Webhook Events Table (Generic Idempotency & Audit)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(30) NOT NULL DEFAULT 'cashfree',
    event_id VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    signature TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'received',
    processing_error TEXT NULL,
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_webhook_status CHECK (status IN ('received', 'processed', 'ignored', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_provider_event ON public.webhook_events (provider, event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_status ON public.webhook_events (status) WHERE status = 'received';


-- 7. Automatic Updated_At Timestamp Triggers
-- Reuses existing public.handle_updated_at() defined in 20260901160000_create_intake_tables.sql
DROP TRIGGER IF EXISTS set_consultation_slots_updated_at ON public.consultation_slots;
CREATE TRIGGER set_consultation_slots_updated_at
    BEFORE UPDATE ON public.consultation_slots
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_consultations_updated_at ON public.consultations;
CREATE TRIGGER set_consultations_updated_at
    BEFORE UPDATE ON public.consultations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_payment_orders_updated_at ON public.payment_orders;
CREATE TRIGGER set_payment_orders_updated_at
    BEFORE UPDATE ON public.payment_orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_payment_refunds_updated_at ON public.payment_refunds;
CREATE TRIGGER set_payment_refunds_updated_at
    BEFORE UPDATE ON public.payment_refunds
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- 8. Row Level Security (RLS) Configuration
-- Enabling RLS denies all anonymous and public access by default.
-- Trusted backend service accesses tables via SUPABASE_SERVICE_ROLE_KEY which automatically bypasses RLS.
ALTER TABLE public.consultation_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
