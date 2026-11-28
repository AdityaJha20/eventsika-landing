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

Docker is optional. It provides a Linux/Node 24 environment matching CI. Supabase, Upstash Redis, the payment provider (Cashfree on `main`) and email are **managed external services**; no database or Redis containers are run locally, and no migrations or seeds are executed.

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
| `RESEND_API_KEY` / `SENDGRID_API_KEY` / `LEAD_WEBHOOK_URL` | Email delivery channel | runtime only | **Private** |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENVIRONMENT` | Payment provider (sandbox locally) | runtime only | **Private** |

Private values are never build arguments and never `NEXT_PUBLIC_*`.

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
The marketing pages, package estimator and `/api/health` work. Lead/vendor submission, slot lookup, booking, payments and admin login return errors or 503 until the matching services are configured.
