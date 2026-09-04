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

