# Estimate PDF download leads

Visitors on `/estimate` give a mobile number **or** an email address and tick a consent box before the
estimate PDF downloads. Each such capture is one row in `public.estimate_download_leads`.

## What these records are, and are not

- They are **PDF-download enquiry records**: someone asked for an indicative estimate PDF and agreed to be
  contacted about that estimate.
- They are **not** confirmed bookings, **not** paid leads, and **not** quotes or invoices.
- The phone number or email is **format-validated only, not verified** as belonging to the visitor.
- Consent covers storing the details and following up **about this estimate only**. It is not consent for
  promotional WhatsApp, email or marketing campaigns.
- They are kept separate from `public.leads` (the full enquiry form) and from vendor applications on
  purpose, because the data contracts differ. Do not merge them into those lists without reviewing that.

## Where to see them

Supabase dashboard → Table Editor → `estimate_download_leads` (newest first via `created_at`).

| Column | Meaning |
|---|---|
| `contact_type` / `contact_value` | `phone` (10-digit Indian mobile) or `email` (lowercased) |
| `package_tier`, `guest_count`, `selected_service_ids` | The visitor's selection |
| `estimate_snapshot`, `total_estimate_rupees` | Estimate calculated by the server from `src/lib/packages-config.ts` at capture time |
| `consent_to_contact`, `consent_text_version`, `consented_at` | Always `true`; which wording was shown (`ESTIMATE_DOWNLOAD_CONSENT_VERSION`); when |
| `idempotency_key` | Stops repeated clicks or retries from creating duplicate rows |

No IP address or user agent is stored.

## How it works

1. `src/app/estimate/DownloadEstimatePdfButton.tsx` posts the contact, selection, consent and an
   idempotency key to `POST /api/estimate-downloads`.
2. The route (`src/app/api/estimate-downloads/route.ts`) checks the origin, rate limit (fails closed in
   production), payload size and strict schema
   (`src/lib/backend/validation/estimate-download-schema.ts`), recalculates the estimate on the server
   and inserts through the service-role client. Client prices are never accepted.
3. The PDF is generated only after the server confirms the row is stored. If saving fails, nothing
   downloads and the visitor can retry. If the PDF fails after saving, a retry rebuilds only the PDF.

The wording shown to visitors lives in `src/lib/estimate-download-contact.ts`. **Bump
`ESTIMATE_DOWNLOAD_CONSENT_VERSION` whenever that wording changes.**

## Security

Migration: `supabase/migrations/20261126110500_create_estimate_download_leads.sql`

- RLS enabled, no policies.
- All privileges revoked from `PUBLIC`, `anon` and `authenticated`.
- `service_role` has `SELECT` and `INSERT` only (no `UPDATE`/`DELETE`). The service-role key is used
  only on the server via `getSupabaseAdminClient()`.
- Logs carry the request ID, capture ID, contact type and package tier only, never the contact or IP.

## Owner follow-ups (not decided in code)

- **Retention period** for these records, and how deletion will be done (service_role cannot delete;
  use the dashboard or a reviewed migration/job).
- **Privacy policy** covering this capture must be approved and published (the footer legal links are
  hidden until then).
- Who follows up on these records, and how.
