-- Store a self-contained snapshot of the estimate submitted with an enquiry:
-- package name, guest count, each selected service's name, per-person rate and
-- subtotal, the per-person total and the grand total, as priced by the server
-- at submission time.
-- Additive only: existing leads keep their data and receive NULL.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS package_estimate_snapshot JSONB NULL;

-- A CHECK passes when its expression is NULL, so every test below is written to
-- yield TRUE or FALSE only: key existence uses `?` (never NULL on a non-NULL
-- object), JSON types are compared only after the key is known to exist,
-- comparisons are jsonb-to-jsonb (no text casts that could fail or go NULL),
-- and the whole branch is wrapped in COALESCE(..., FALSE) as a final guard.
ALTER TABLE public.leads
  ADD CONSTRAINT chk_leads_package_estimate_snapshot
    CHECK (
      package_estimate_snapshot IS NULL
      OR COALESCE(
        (
          jsonb_typeof(package_estimate_snapshot) = 'object'
          AND package_tier IS NOT NULL
          AND package_combined_estimate_rupees IS NOT NULL
          AND package_estimate_snapshot ? 'packageId'
          AND jsonb_typeof(package_estimate_snapshot -> 'packageId') = 'string'
          AND package_estimate_snapshot -> 'packageId' = to_jsonb(package_tier)
          AND package_estimate_snapshot ? 'totalEstimateRupees'
          AND jsonb_typeof(package_estimate_snapshot -> 'totalEstimateRupees') = 'number'
          AND package_estimate_snapshot -> 'totalEstimateRupees' = to_jsonb(package_combined_estimate_rupees)
        ),
        FALSE
      )
    );

COMMENT ON COLUMN public.leads.package_estimate_snapshot IS
  'Server-calculated estimate snapshot (package, guests, services with per-person rates, subtotals, total); indicative only, not a booking or invoice. NULL for enquiries without an estimate.';
