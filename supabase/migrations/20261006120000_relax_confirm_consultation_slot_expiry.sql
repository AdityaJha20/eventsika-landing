-- ==============================================================================
-- Migration: 20261006120000_relax_confirm_consultation_slot_expiry.sql
-- Step 6 Foundation: DB-001 Fix — Relax confirm_consultation_slot RPC expiry predicate.
--
-- Rationale:
-- A customer may successfully complete payment near the end of their 15-minute
-- reservation window, resulting in a payment gateway webhook that arrives after
-- reserved_until has elapsed.
--
-- The 256-bit reservation_token already provides cryptographic mutual exclusion:
-- if another customer has legitimately claimed the slot after expiry, the
-- reservation_token on the slot will have changed, preventing the late confirmation
-- from confirming or stealing that slot.
--
-- Therefore, confirm_consultation_slot must match:
--   WHERE id = p_slot_id
--     AND status = 'reserved'
--     AND reservation_token = p_reservation_token
-- without requiring `AND reserved_until >= now()`.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.confirm_consultation_slot(
    p_slot_id UUID,
    p_reservation_token VARCHAR(64)
)
RETURNS public.consultation_slots
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_slot public.consultation_slots;
BEGIN
    UPDATE public.consultation_slots
    SET status = 'booked',
        reservation_token = NULL,
        reserved_until = NULL,
        updated_at = now()
    WHERE id = p_slot_id
      AND status = 'reserved'
      AND reservation_token = p_reservation_token
    RETURNING * INTO v_slot;

    RETURN v_slot;
END;
$$;

-- Preserve existing security model: execute restricted strictly to service_role
REVOKE ALL ON FUNCTION public.confirm_consultation_slot(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_consultation_slot(UUID, VARCHAR) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_consultation_slot(UUID, VARCHAR) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_consultation_slot(UUID, VARCHAR) TO service_role;
