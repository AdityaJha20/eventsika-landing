-- ==============================================================================
-- Migration: 20261006140000_add_reservation_token_to_payment_orders.sql
-- Step 6 Foundation: Persist original reservation_token on payment_orders.
--
-- Rationale:
-- Preserves the slot's original reservation token on the payment order across the
-- asynchronous payment boundary.
--
-- In the event that a payment completes near or after hold expiration, Cashfree
-- webhooks contain only the external order_id. Storing the validated reservation_token
-- on payment_orders allows Step 6 confirmation to execute confirm_consultation_slot
-- with the customer's original token, ensuring mutual exclusion and preventing slot
-- hijacking if the slot has been subsequently claimed by another customer.
-- ==============================================================================

ALTER TABLE public.payment_orders
ADD COLUMN IF NOT EXISTS reservation_token VARCHAR(64) NULL;
