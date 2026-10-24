-- Add optional, server-recomputed planning package quote details to celebration leads.
-- Existing leads remain valid and receive NULL quote fields and an empty add-on array.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS package_tier TEXT NULL,
  ADD COLUMN IF NOT EXISTS package_guest_count INTEGER NULL,
  ADD COLUMN IF NOT EXISTS package_vendor_addon_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS package_planning_fee_rupees INTEGER NULL,
  ADD COLUMN IF NOT EXISTS package_vendor_estimate_rupees INTEGER NULL,
  ADD COLUMN IF NOT EXISTS package_combined_estimate_rupees INTEGER NULL;

ALTER TABLE public.leads
  ADD CONSTRAINT chk_leads_package_tier
    CHECK (package_tier IS NULL OR package_tier IN ('essential', 'premium', 'luxury')),
  ADD CONSTRAINT chk_leads_package_guest_count
    CHECK (package_guest_count IS NULL OR package_guest_count BETWEEN 10 AND 10000),
  ADD CONSTRAINT chk_leads_package_planning_fee
    CHECK (package_planning_fee_rupees IS NULL OR package_planning_fee_rupees > 0),
  ADD CONSTRAINT chk_leads_package_vendor_estimate
    CHECK (package_vendor_estimate_rupees IS NULL OR package_vendor_estimate_rupees >= 0),
  ADD CONSTRAINT chk_leads_package_combined_estimate
    CHECK (package_combined_estimate_rupees IS NULL OR package_combined_estimate_rupees > 0),
  ADD CONSTRAINT chk_leads_package_quote_consistency
    CHECK (
      (
        package_tier IS NULL
        AND package_guest_count IS NULL
        AND package_planning_fee_rupees IS NULL
        AND package_vendor_estimate_rupees IS NULL
        AND package_combined_estimate_rupees IS NULL
        AND cardinality(package_vendor_addon_ids) = 0
      )
      OR
      (
        package_tier IS NOT NULL
        AND package_guest_count IS NOT NULL
        AND package_planning_fee_rupees IS NOT NULL
        AND package_vendor_estimate_rupees IS NOT NULL
        AND package_combined_estimate_rupees IS NOT NULL
        AND package_combined_estimate_rupees =
          package_planning_fee_rupees + package_vendor_estimate_rupees
      )
    );

COMMENT ON COLUMN public.leads.package_tier IS
  'Optional Eventsika planning tier selected by the customer; NULL for enquiries without a package quote.';
COMMENT ON COLUMN public.leads.package_vendor_addon_ids IS
  'Selected third-party vendor estimate identifiers; these are estimates, not confirmed vendor bookings.';
COMMENT ON COLUMN public.leads.package_combined_estimate_rupees IS
  'Server-calculated planning fee plus indicative vendor estimates, in whole INR rupees; not a confirmed all-inclusive quote.';
