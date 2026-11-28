# Razorpay activation and payment operations (owner guide)

Nothing in this guide has been executed against staging or production. Every step
below is a manual action for the owner. Never paste secret values into chat, tickets,
commits or this file.

## 1. Before anything goes live

1. Razorpay account: KYC complete, account activated, settlement bank verified.
2. Dashboard security (Razorpay merchant security checklist):
   - 2FA on for every dashboard user; never share OTPs.
   - One named login per person; least-privilege roles; remove leavers immediately.
   - API keys visible only to the people who deploy.
3. Capture setting: keep **automatic capture** on (Dashboard → Account & Settings →
   Payment capture). The code only treats a *captured* payment as paid; an authorized
   payment stays "verifying" and is flagged by reconciliation after 6 hours.
   Razorpay refunds uncaptured payments automatically after ~3 days.

## 2. Environment variables (Hostinger → Node.js app → Environment)

| Variable | Notes |
|---|---|
| `RAZORPAY_KEY_ID` | `rzp_test_…` on staging, `rzp_live_…` on production. Only value ever sent to browsers. |
| `RAZORPAY_KEY_SECRET` | Server only. |
| `RAZORPAY_WEBHOOK_SECRET` | Server only. Must differ from the key secret. Set the same value in the dashboard webhook. |
| `RAZORPAY_MODE` | `test` or `live`; must match the key prefix or payments fail closed (503). |
| `PAYMENT_PROVIDER` | Optional; if set must be `razorpay`. |
| `PAYMENTS_KILL_SWITCH` | Empty normally. `on` pauses NEW reservations/orders (see §7). |
| `PAYMENT_RECONCILIATION_SECRET` | ≥ 32 random characters. Enables the scheduler endpoint. |
| `RESEND_API_KEY` or `SENDGRID_API_KEY`, `EMAIL_FROM` | Needed for customer receipts/confirmations. Without one, notifications stay queued and become `notification_failed` issues. |
| `CASHFREE_SECRET_KEY` | Keep until Cashfree retirement (verifies late legacy webhooks). |

The server logs `[startup-config] …` with variable *names* if anything is missing.
Payment routes return 503 until the configuration is complete and consistent.

## 3. Database migration

1. Take a Supabase backup / PITR checkpoint.
2. Apply `supabase/migrations/20261126120000_add_razorpay_payment_gateway_support.sql`
   to **staging first** (Supabase SQL editor or `supabase db push` against staging).
3. Verify on staging:
   - `select provider, count(*) from payment_orders group by 1;` → existing rows are `cashfree`.
   - `select proname, prosecdef, proconfig from pg_proc where proname in ('apply_payment_event','claim_webhook_event','create_payment_refund_intent','rebook_conflicted_consultation','claim_payment_notification');`
     → `prosecdef = false`, `proconfig` contains `search_path=""`.
   - As the `anon` role, `select * from payment_orders` must fail.
4. Only then apply to production.

## 4. Finance administrator access

Refunds, issue resolution and manual reconciliation require `app_metadata.role = "admin"`
**and** `app_metadata.finance_admin = true`. Grant it per person with the service role
(Supabase dashboard → Authentication → user → edit app metadata), e.g.
`{"role": "admin", "finance_admin": true}`. Ordinary admins can only view `/admin/payments`.
There is no "mark as paid" action anywhere, by design.

## 5. Webhook registration (Razorpay Dashboard → Webhooks)

- URL: `https://<your-domain>/api/razorpay/webhook` (port 443 only).
- Secret: the `RAZORPAY_WEBHOOK_SECRET` value.
- Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`,
  `refund.created`, `refund.processed`, `refund.failed`.
- Separate webhooks for Test and Live mode.
- IP allowlisting is optional defence in depth: use Razorpay's currently published webhook
  IP list (docs → Security → Whitelists) at the firewall/CDN only if Hostinger supports it.
  Never hard-code IPs in the app; HMAC verification is the primary control.

## 6. Reconciliation schedule

Run `POST https://<your-domain>/api/internal/payments/reconcile` with header
`Authorization: Bearer <PAYMENT_RECONCILIATION_SECRET>` every 10–15 minutes, e.g. a
Hostinger cron job running `curl -fsS -X POST -H "Authorization: Bearer $SECRET" <url>`.
If no scheduler is available, a finance admin can press **Run reconciliation** in
`/admin/payments`. Running it twice is harmless.

## 7. Payments kill switch (incident procedure)

1. Set `PAYMENTS_KILL_SWITCH=on` in Hostinger and restart the app.
2. Effect: new slot holds and new payment orders return 503 with a "bookings paused" message.
   Unaffected: webhooks, checkout verification of payments already in progress, customer
   status page, slot-conflict re-booking, refunds, reconciliation, admin views.
3. Investigate using `/admin/payments` (open issues) and the Razorpay dashboard.
4. Clear the variable and restart to resume. Record the incident (time, reason, actor).

## 8. Staging validation (Razorpay test mode) — required before live

Record evidence (screenshots / IDs) for each:

- [ ] Successful payment → status page shows confirmed; receipt + confirmation (.ics) emails arrive once.
- [ ] Failed payment (test failure card/UPI) → "payment not completed", retry on the same order works.
- [ ] Checkout dismissed → no false failure; retry allowed only when nothing is pending.
- [ ] Late webhook (pause the webhook, pay, re-enable) → reconciliation confirms it.
- [ ] Duplicate webhook (dashboard "resend") → no second effect, no second email.
- [ ] Forged webhook (wrong signature) → 401, nothing stored.
- [ ] Slot conflict (let the hold expire, have another booking take the slot, then pay) →
      "payment received, pick a new time", rebook works without a second charge.
- [ ] Full refund and partial refund → "processing" then "processed" only after Razorpay confirms.
- [ ] Browser console shows no CSP violations during checkout (adjust `next.config.ts` only from observed reports).
- [ ] Live mode: one real low-risk payment by the owner, refunded, and visible in settlements.

## 9. Cashfree retirement (do not remove yet)

Retire only when **all** hold, verified on the live database:
1. `select count(*) from payment_orders where provider='cashfree' and status in ('created','attempted');` = 0
2. No Cashfree consultation in `slot_conflict_pending_reschedule` without resolution.
3. `select count(*) from payment_refunds where provider='cashfree' and status in ('pending','initiated');` = 0
4. No Cashfree webhook received for at least the provider's retry window.
5. Historical Cashfree rows remain visible in `/admin/payments` (they do; provider column).
6. Owner approval recorded.

Then remove: `/api/cashfree/webhook`, the Cashfree adapter, parser, verifier,
`components/consultation/utils/cashfree-loader.ts`, and `CASHFREE_*` variables.
Never delete or rewrite Cashfree rows.

## 10. Backups, monitoring and secrets rotation

- Keep Supabase PITR enabled; test a restore before go-live.
- Watch `/admin/payments` open issues daily; every issue kind is documented in the migration header.
- Rotate the Razorpay key or webhook secret by: create new value → update Hostinger env →
  restart → update dashboard → revoke old value. During webhook-secret rotation Razorpay may
  sign retries of old deliveries with the old secret; expect a short burst of 401s.
- Customer data retention: `webhook_events.payload` stores a minimal, contact-free payload;
  define a retention period (e.g. 13 months) and purge older processed events.
