-- ==============================================================================
-- Estimate PDF download leads
--
-- One row per visitor who gave a mobile number or email address, with consent,
-- before downloading an indicative estimate PDF from /estimate.
--
-- These are PDF-download enquiry records only: NOT confirmed bookings, NOT paid
-- leads, and the phone/email is format-validated but NOT verified as belonging
-- to the visitor. They are deliberately kept separate from public.leads.
--
-- Written only by POST /api/estimate-downloads through the server-side
-- service-role client. No IP address or user agent is stored.
-- Retention period: not yet decided (owner follow-up).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.estimate_download_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Contact (normalized by the server: 10-digit mobile or lowercase email)
    contact_type VARCHAR(5) NOT NULL,
    contact_value VARCHAR(254) NOT NULL,

    -- Estimate selection, validated against the public catalog
    package_tier VARCHAR(20) NOT NULL,
    guest_count INTEGER NOT NULL,
    selected_service_ids TEXT[] NOT NULL DEFAULT '{}',

    -- Server-calculated estimate (never client-supplied prices)
    estimate_snapshot JSONB NOT NULL,
    total_estimate_rupees INTEGER NOT NULL,

    -- Consent to store the details and follow up about this estimate only
    consent_to_contact BOOLEAN NOT NULL,
    consent_text_version VARCHAR(32) NOT NULL,
    consented_at TIMESTAMPTZ NOT NULL,

    -- Client-generated per attempt; repeated submissions reuse the same row
    idempotency_key UUID NOT NULL,

    CONSTRAINT uq_estimate_download_leads_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT chk_estimate_download_leads_contact_type
        CHECK (contact_type IN ('phone', 'email')),
    CONSTRAINT chk_estimate_download_leads_contact_value
        CHECK (
            (contact_type = 'phone' AND contact_value ~ '^[6-9][0-9]{9}$')
            OR (
                contact_type = 'email'
                AND contact_value = lower(contact_value)
                AND contact_value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
            )
        ),
    CONSTRAINT chk_estimate_download_leads_package_tier
        CHECK (package_tier IN ('essential', 'premium', 'luxury')),
    -- Mirrors MIN_GUEST_COUNT / MAX_GUEST_COUNT in src/lib/packages-config.ts
    CONSTRAINT chk_estimate_download_leads_guest_count
        CHECK (guest_count BETWEEN 10 AND 10000),
    -- Mirrors OPTIONAL_SERVICE_IDS; duplicates are rejected by the API
    CONSTRAINT chk_estimate_download_leads_service_ids
        CHECK (
            cardinality(selected_service_ids) <= 8
            AND selected_service_ids <@ ARRAY[
                'food', 'floral', 'bartending', 'housekeeping',
                'valet', 'light-sound', 'photography', 'videography'
            ]::TEXT[]
        ),
    CONSTRAINT chk_estimate_download_leads_total
        CHECK (total_estimate_rupees > 0),
    -- Same NULL-safe pattern as chk_leads_package_estimate_snapshot: the snapshot
    -- must agree with the typed columns it was calculated from.
    CONSTRAINT chk_estimate_download_leads_snapshot
        CHECK (
            COALESCE(
                (
                    jsonb_typeof(estimate_snapshot) = 'object'
                    AND estimate_snapshot ? 'packageId'
                    AND estimate_snapshot -> 'packageId' = to_jsonb(package_tier)
                    AND estimate_snapshot ? 'guestCount'
                    AND estimate_snapshot -> 'guestCount' = to_jsonb(guest_count)
                    AND estimate_snapshot ? 'totalEstimateRupees'
                    AND estimate_snapshot -> 'totalEstimateRupees' = to_jsonb(total_estimate_rupees)
                ),
                FALSE
            )
        ),
    CONSTRAINT chk_estimate_download_leads_consent
        CHECK (consent_to_contact = TRUE),
    CONSTRAINT chk_estimate_download_leads_consent_version
        CHECK (char_length(consent_text_version) BETWEEN 1 AND 32)
);

-- Newest-first listing in the Table Editor / admin follow-up
CREATE INDEX IF NOT EXISTS idx_estimate_download_leads_created_at
    ON public.estimate_download_leads (created_at DESC);
-- Finding earlier downloads by the same contact
CREATE INDEX IF NOT EXISTS idx_estimate_download_leads_contact_value
    ON public.estimate_download_leads (contact_value);

-- ------------------------------------------------------------------------------
-- Security
-- RLS on with no policies: anon and authenticated (browser keys) get nothing.
-- Table privileges are revoked from them as well, so access does not depend on
-- RLS alone. service_role (server only) may insert and read back; it has no
-- UPDATE or DELETE.
-- ------------------------------------------------------------------------------
ALTER TABLE public.estimate_download_leads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.estimate_download_leads FROM PUBLIC;
REVOKE ALL ON TABLE public.estimate_download_leads FROM anon;
REVOKE ALL ON TABLE public.estimate_download_leads FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.estimate_download_leads TO service_role;

COMMENT ON TABLE public.estimate_download_leads IS
  'Estimate PDF download enquiries: contact given with consent before downloading an indicative estimate. Not bookings, not paid leads; contact is format-validated, not verified. Retention period pending owner decision.';
COMMENT ON COLUMN public.estimate_download_leads.contact_value IS
  'Normalized 10-digit Indian mobile number or lowercase email address. Not verified.';
COMMENT ON COLUMN public.estimate_download_leads.estimate_snapshot IS
  'Server-calculated estimate snapshot (same shape as leads.package_estimate_snapshot); indicative only, not a quote or invoice.';
COMMENT ON COLUMN public.estimate_download_leads.consent_text_version IS
  'ESTIMATE_DOWNLOAD_CONSENT_VERSION of the disclosure and checkbox wording shown to the visitor.';
COMMENT ON COLUMN public.estimate_download_leads.idempotency_key IS
  'Client-generated per download attempt; a repeated request with the same key returns the existing row.';
