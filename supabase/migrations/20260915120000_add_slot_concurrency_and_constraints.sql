-- ==============================================================================
-- Eventsika Booking & Slot Engine Concurrency & Constraints Migration (Step 2)
-- Uniqueness: Unique slot start_time, confirmed consultation slot uniqueness
-- Functions: reserve_consultation_slot, release_consultation_slot, confirm_consultation_slot
-- Security: SECURITY INVOKER, privileges restricted to service_role
-- ==============================================================================

-- 1. Slot Generation Uniqueness: Prevents duplicate slot rows for the same start_time
CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_start_time_unique
    ON public.consultation_slots (start_time);

-- 2. Confirmed Consultation Uniqueness: Permanent invariant that at most one confirmed consultation exists per slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultations_confirmed_slot
    ON public.consultations (slot_id)
    WHERE status = 'confirmed';

-- 3. Atomic Slot Reservation Function (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.reserve_consultation_slot(
    p_slot_id UUID,
    p_reservation_token VARCHAR(64),
    p_hold_duration_minutes INT DEFAULT 15
)
RETURNS public.consultation_slots
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_slot public.consultation_slots;
BEGIN
    UPDATE public.consultation_slots
    SET status = 'reserved',
        reservation_token = p_reservation_token,
        reserved_until = now() + (p_hold_duration_minutes || ' minutes')::interval,
        updated_at = now()
    WHERE id = p_slot_id
      AND (
          status = 'available'
          OR (status = 'reserved' AND reserved_until < now())
      )
    RETURNING * INTO v_slot;

    RETURN v_slot;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_consultation_slot(UUID, VARCHAR, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_consultation_slot(UUID, VARCHAR, INT) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_consultation_slot(UUID, VARCHAR, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_consultation_slot(UUID, VARCHAR, INT) TO service_role;

-- 4. Atomic Slot Release Function (Compensation only, requires valid reservation token)
CREATE OR REPLACE FUNCTION public.release_consultation_slot(
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
    SET status = 'available',
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

REVOKE ALL ON FUNCTION public.release_consultation_slot(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_consultation_slot(UUID, VARCHAR) FROM anon;
REVOKE ALL ON FUNCTION public.release_consultation_slot(UUID, VARCHAR) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_consultation_slot(UUID, VARCHAR) TO service_role;

-- 5. Atomic Slot Confirmation Function (Validates token and non-expired time)
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
      AND reserved_until >= now()
    RETURNING * INTO v_slot;

    RETURN v_slot;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_consultation_slot(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_consultation_slot(UUID, VARCHAR) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_consultation_slot(UUID, VARCHAR) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_consultation_slot(UUID, VARCHAR) TO service_role;
