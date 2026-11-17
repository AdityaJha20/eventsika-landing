-- Collect the enquirer's email address and record email contact consent separately from WhatsApp consent.
-- Additive only: existing leads keep their data, receive a NULL email and email_consent = false.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS user_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS email_consent BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.leads
  ADD CONSTRAINT chk_leads_user_email_len
    CHECK (user_email IS NULL OR char_length(user_email) BETWEEN 3 AND 254);

COMMENT ON COLUMN public.leads.user_email IS
  'Lowercased enquirer email; NULL for leads submitted before email was collected.';
COMMENT ON COLUMN public.leads.email_consent IS
  'True only when the enquirer explicitly agreed to email contact; never inferred from whatsapp_consent.';
