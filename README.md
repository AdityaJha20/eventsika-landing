This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Production Security & Ingress Architecture

### 1. Reverse-Proxy & Ingress Trust Assumptions
Eventsika rate limiters extract client IP addresses via `getClientIp()` by checking edge proxy headers (`cf-connecting-ip`, `x-real-ip`, and `x-forwarded-for`).
- **Application Security Boundary**: Application code running in Node.js cannot cryptographically distinguish between a genuine header added by a trusted reverse proxy and a spoofed header injected by a client when exposed directly to the public internet without an ingress filter.
- **Production Deployment Invariant (Hostinger / Cloudflare / Nginx)**:
  - The edge/ingress reverse proxy (e.g. Cloudflare proxy, Hostinger OpenLiteSpeed/Nginx reverse proxy) MUST be configured to **overwrite or strip** client-supplied `X-Forwarded-For` and `CF-Connecting-IP` headers before requests reach the Next.js process.
  - On Hostinger VPS or standalone Node deployments, ensure Nginx passes `$remote_addr` as `X-Real-IP` and `$proxy_add_x_forwarded_for` as `X-Forwarded-For`, resetting untrusted upstream client values.

### 2. Environment Configuration
- Public variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) are safe for browser and SSR usage.
- Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) must never be prefixed with `NEXT_PUBLIC_` and are validated by `src/lib/backend/config/env.ts`.

### 3. Fail-Closed Security Policy
- When running in `NODE_ENV === "production"`, if distributed Upstash Redis is unconfigured or unreachable, rate limiters fail closed (HTTP 503), preventing unthrottled brute-force or denial-of-service abuse.
- In development/test environments, an in-memory fallback store is used automatically for zero-dependency offline workflows.


## Docker Development Environment

Docker is optional. It provides a Linux/Node 24 environment matching CI. Supabase, Upstash Redis, the payment provider (Razorpay; Cashfree only for historical records) and email are **managed external services**; no database or Redis containers are run locally, and no migrations or seeds are executed.

### Files
- `Dockerfile`: multi-stage build: `deps` (`npm ci`), `dev` (`next dev`), `builder` (`npm run build`, i.e. `next build --webpack`, giving `.next/standalone`), `runner` (non-root `node server.js`).
- `compose.yaml`: `dev` profile (hot reload on port 3000) and `prod` profile (production-style image on port 3001). Both bind to `127.0.0.1` only.
- `.env.docker.example`: placeholder template. Copy it to `.env.docker` (git-ignored and docker-ignored) and fill in **development/staging** values only.

### Environment variables
| Variable | Purpose | When read | Visibility |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | robots.txt / sitemap base URL (static, evaluated during `next build`) | **build** | Public |
| `SUPABASE_URL` | Supabase project URL (preferred, server) | runtime | Public |
| `NEXT_PUBLIC_SUPABASE_URL` | Fallback for the URL | build if passed as a build arg, otherwise runtime | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key for admin auth sessions | build if passed as a build arg, otherwise runtime | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | Legacy fallbacks for the key | runtime | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Server DB access (bypasses RLS) | runtime only | **Private** |
| `RATE_LIMIT_BACKEND` | `upstash` or `memory` | runtime | Private config |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting | runtime only | **Private** |
| `NOTIFICATION_EMAIL`, `EMAIL_FROM` | Lead/vendor notifications | runtime | Private config |
| `RESEND_API_KEY` / `SENDGRID_API_KEY` / `LEAD_WEBHOOK_URL` | Email delivery channel. Customer receipts and confirmations need Resend or SendGrid; the webhook URL only carries internal lead/vendor notifications. | runtime only | **Private** |
| Payment variables | See [Payments (Razorpay)](#payments-razorpay) | runtime only | Mixed (see below) |

Private values are never build arguments and never `NEXT_PUBLIC_*`.

### Payments (Razorpay)
All new consultation payments use Razorpay. Every payment variable is read **at runtime** by the server from the git-ignored `.env.docker` file. None is a `NEXT_PUBLIC_*` variable or a build argument, so none is ever baked into an image. The rules below come from `src/lib/backend/config/env.ts`.

| Variable | Purpose and validation | Visibility |
|---|---|---|
| `RAZORPAY_KEY_ID` | API key id. Must match `rzp_test_…` or `rzp_live_…`. | **Public**: the only payment value the browser ever receives, and only inside the payment order API response. |
| `RAZORPAY_KEY_SECRET` | API authentication and checkout signature verification. | **Private** |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies `X-Razorpay-Signature` on `/api/razorpay/webhook`. Must **differ** from `RAZORPAY_KEY_SECRET` and equal the secret set on the Razorpay webhook. | **Private** |
| `RAZORPAY_MODE` | `test` or `live`. Must match the key id prefix. | Config |
| `PAYMENT_PROVIDER` | Optional. If set, it must be `razorpay`. | Config |
| `PAYMENT_RECONCILIATION_SECRET` | Bearer token for `POST /api/internal/payments/reconcile`. Needs at least 32 characters; shorter or empty disables the endpoint (404). | **Private** |
| `PAYMENTS_KILL_SWITCH` | Leave empty normally. `1`, `true`, `on` or `yes` pauses **new** reservations and payment orders; verification, webhooks and reconciliation keep running. | Config |
| `CASHFREE_SECRET_KEY` | **Legacy only.** Verifies late webhooks for historical Cashfree orders on `/api/cashfree/webhook`. Keep it until Cashfree is retired. | **Private** |

- **Fail-closed behaviour:** payment routes return **503** until `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and `RAZORPAY_MODE` are all present and consistent. At startup the server logs the names (never the values) of anything missing, prefixed `[startup-config]`.
- **Cashfree leftovers in the template:** `.env.docker.example` also lists `CASHFREE_APP_ID` and `CASHFREE_ENVIRONMENT`. No running code path needs them, so leave them blank.
- **Never commit `.env.docker`.** It is git-ignored and docker-ignored. Never paste real keys into the README, issues or chat.

#### TEST mode setup (local Docker)
1. **Use a development Supabase project, never production.**
   - Back it up (see `docs/payments/razorpay-activation-and-operations.md`, section 3).
   - Run this read-only preflight. It must return **0 rows**, otherwise the migration's one-live-order index cannot be created:
     ```sql
     SELECT consultation_id, count(*) FROM public.payment_orders
     WHERE status IN ('created', 'attempted', 'paid')
     GROUP BY consultation_id HAVING count(*) > 1;
     ```
   - Then apply `supabase/migrations/20261126120000_add_razorpay_payment_gateway_support.sql`.
2. **In the Razorpay Dashboard, switch to *Test Mode*.** Generate test API keys, and keep **automatic capture** enabled. Only captured payments count as paid.
3. **Expose the dev server over HTTPS for webhooks.** Razorpay cannot reach `127.0.0.1`, so use a temporary tunnel (for example cloudflared or ngrok) pointing at `http://127.0.0.1:3000`.
4. **Create a test-mode webhook** for `https://<your-tunnel-host>/api/razorpay/webhook`. Give it its own secret and subscribe to these events:
   - `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`
   - `refund.created`, `refund.processed`, `refund.failed`
5. **Fill in `.env.docker`:**
   - Supabase dev values.
   - `RAZORPAY_KEY_ID` (starts `rzp_test_`), `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `RAZORPAY_MODE=test`.
   - Optionally `PAYMENT_RECONCILIATION_SECRET` (32+ random characters), and `RESEND_API_KEY` or `SENDGRID_API_KEY` with `EMAIL_FROM` pointed at a test inbox.
6. **Start the stack** with `docker compose --profile dev up --build`, then book a consultation. Pay with one of Razorpay's documented **test** payment methods. No real money moves in Test Mode.
7. **Refund testing** needs an admin user whose Supabase `app_metadata` has `role: "admin"` **and** `finance_admin: true`.
8. **Run reconciliation manually** when needed. This reads the secret from your shell, so it never sits in a file or in history:
   ```powershell
   $secret = Read-Host -AsSecureString "Reconciliation secret"
   $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret))
   Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/internal/payments/reconcile -Headers @{ Authorization = "Bearer $plain" }
   ```

Switching to live keys (`rzp_live_…`, `RAZORPAY_MODE=live`, and a separate live webhook and secret) is a production step. It belongs in the hosting provider's environment settings, not in Docker.

**Build time vs runtime (prod image).** Next.js inlines every `NEXT_PUBLIC_*` variable that is *defined* during `next build` into the compiled output. Once compiled in, a runtime value cannot change it. In this codebase no browser code reads `NEXT_PUBLIC_*`. They are read only by server code: the Supabase clients, `src/middleware.ts`, robots and sitemap. As a result:
- **Omitted build args** stay undefined at build time, so the server reads them from `.env.docker` at runtime. This is the default, and one image then works across environments.
- **Supplied build args** are compiled in permanently. Runtime values for that variable are then ignored.
- `NEXT_PUBLIC_SITE_URL` is only used by the static robots.txt and sitemap.xml, so it takes effect **only as a build arg**. Without it, they use `https://eventsika.in`.

Build args come from the shell that runs `docker compose`, **not** from `.env.docker`, which is runtime-only:
```powershell
$env:NEXT_PUBLIC_SITE_URL = "https://staging.example.com"
docker compose --profile prod build --no-cache
Remove-Item Env:NEXT_PUBLIC_SITE_URL
```
If any future browser code reads a `NEXT_PUBLIC_*` value, that value must be supplied as a build arg. Runtime `.env` files cannot change an already-built browser bundle.

### Development (PowerShell)
```powershell
Copy-Item .env.docker.example .env.docker   # then edit with dev/staging values
docker compose --profile dev up --build      # http://127.0.0.1:3000
```
Stop with `Ctrl+C`, then `docker compose --profile dev down`. Add `-v` to also delete the `node_modules`/`.next` volumes, which you need after changing `package-lock.json`.

**Hot reload:** the dev service runs `next dev --webpack` with `WATCHPACK_POLLING=true`. When the repo lives on a Windows drive, Docker Desktop does not deliver file-change events to Turbopack. Turbopack (the Next 16 default) did not pick up edits in testing, while webpack with polling did, in about 2–3 s. If you clone the repo inside the WSL file system instead, Turbopack's native watcher can be used.

### Production-style image (local testing only, not a deployment)
```powershell
docker compose --profile prod up --build     # http://127.0.0.1:3001
docker compose --profile prod down
```
- Runs as user `node`, with a read-only root filesystem, `cap_drop: ALL`, `no-new-privileges`, and a tmpfs at `/app/.next/cache` for the image-optimizer cache.
- Its healthcheck uses `GET /api/health`, which reports liveness only. It does not check Supabase, Redis or the payment provider.
- With `NODE_ENV=production` and no Upstash credentials, rate-limited APIs **fail closed (503)** by design. Do not switch this to the memory backend unless you mean to.
- The CSP includes `upgrade-insecure-requests`. Browsers exempt `localhost`/`127.0.0.1`, so this works locally. Any other plain-HTTP hostname will break asset loading, so use HTTPS for non-local testing.

### Without credentials
The marketing pages, package estimator and `/api/health` work. Lead/vendor submission, slot lookup, booking, payments and admin login return errors or 503 until the matching services are configured. Payment routes specifically return 503 until the four `RAZORPAY_*` values are present and consistent.
