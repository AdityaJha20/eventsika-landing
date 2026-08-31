# EVENTSIKA — PROJECT BRAIN

> **GROUND TRUTH NOTICE**: The repository codebase is always the ultimate source of truth. If this document conflicts with the active code, inspect the repository, treat the code as truth, and update `Brain.md` to reflect the architectural change.

---

## 0. Document Control

| Attribute | Details |
| :--- | :--- |
| **Project Name** | Eventsika (`landing`) |
| **Document Path** | [`.agents/project-brain/Brain.md`](file:///d:/Persional-projects/landing/.agents/project-brain/Brain.md) |
| **Brain Version** | `1.0.0` |
| **Creation Date** | `2026-08-30` |
| **Last Verified** | `2026-08-30` |
| **Target Framework** | Next.js `16.3.0` (React `19.2.8`, App Router) |
| **Primary Domain** | `https://eventsika.in` |
| **Support Inbox** | `care@eventsika.in` |
| **Operational Rule** | **Brain-First**: Consult `Brain.md` before initiating any non-trivial architectural, feature, or refactoring task. |

---

## 1. Project Overview

**Eventsika** is a curated event planning, celebration design, and on-ground management platform specialized in Indian celebrations at home, terraces, banquets, and boutique venues across major metropolitan cities in India (Delhi, Gurgaon, Noida, Mumbai, Kolkata, etc.).

### Primary Capabilities & Core Value Proposition
1. **Curated Celebration Services**: Venue decor & floral styling, gourmet catering, live counters, ritual & puja arrangements, photography & cinematography, live entertainment, and bespoke invitations.
2. **Transparent Tiered Pricing**: Structured packages ranging from intimate terrace gatherings (₹35k+) to grand multi-day festive galas (₹1.25L+), with dynamic customizer and comparison tools.
3. **Interactive Lead Generation Engine**: High-conversion, validated celebration intake form (`#plan-event`) with server-side rate limiting, honeypot protection, and multi-channel notification dispatch.
4. **Curated Vendor Partner Network**: Transparent vendor acquisition and onboarding pipeline with verified milestone payouts and on-site event coordination.
5. **Seasonal Strategy Consultations**: High-intent 1-on-1 celebration planning advisory sessions (`/diwali-consultation`).
6. **Client & Partner Portal (Pre-launch)**: Dedicated portal entry point (`/login`) featuring client-side authentication validation and direct operational support routing.

---

## 2. Technology Stack

All dependencies and versions are verified directly from `package.json` and project lockfiles:

| Technology | Version | Category / Purpose | Key Architectural Notes |
| :--- | :--- | :--- | :--- |
| **Next.js** | `16.3.0` | Core Framework | App Router, Server Components default, Turbopack, standalone production build |
| **React** | `19.2.8` | UI Library | Concurrent rendering, React 19 Action & Component APIs |
| **React DOM** | `19.2.8` | DOM Renderer | Browser mounting & SSR hydration |
| **TypeScript** | `^5` | Language | Strict mode (`strict: true`), bundler module resolution, path alias `@/*` -> `./src/*` |
| **React Compiler** | `1.0.0` | Build Optimization | `babel-plugin-react-compiler` enabled via `reactCompiler: true` in `next.config.ts` |
| **Styling** | Vanilla CSS | Design System | Pure CSS Modules (`*.module.css`) + CSS Custom Properties. **Zero Tailwind**. |
| **Typography** | `next/font/google` | Font Management | `Playfair Display` (Serif) & `Inter` (Sans-serif) with CSS variable injection |
| **ESLint** | `^9` | Linting & Standards | Flat config format (`eslint.config.mjs`) using `eslint-config-next: 16.3.0` |
| **Mailer Engine** | Native Fetch | Backend Dispatch | Zero-dependency REST dispatchers for Resend, SendGrid, and Custom Webhooks |
| **Rate Limiter** | In-Memory | Security & Abuse | Sliding/fixed window IP rate limiter with automated stale entry cleanup |

---

## 3. High-Level Architecture

Eventsika follows a clean Next.js 16 App Router architecture with strict Server vs. Client component boundaries:

```mermaid
graph TD
    Client["Browser / Client (Desktop & Mobile)"] --> NextRouter["Next.js 16 App Router (RootLayout)"]
    
    subgraph Frontend ["Presentation Layer (src/app & src/components)"]
        NextRouter --> HomeRoute["/ (Homepage & Hero Intake)"]
        NextRouter --> ServicesRoute["/services (Catalog & Estimator)"]
        NextRouter --> PackagesRoute["/packages (Tiers & Customizer)"]
        NextRouter --> VendorRoute["/for-vendors (Partner Network)"]
        NextRouter --> DiwaliRoute["/diwali-consultation (Promo Advisory)"]
        NextRouter --> LoginRoute["/login (Client/Partner Portal)"]
        NextRouter --> MetadataRoutes["/robots.txt & /sitemap.xml"]
    end

    subgraph BackendAPI ["API & Serverless Layer (src/app/api)"]
        HomeRoute -.->|"POST /api/leads"| LeadAPI["API: /api/leads"]
        VendorRoute -.->|"POST /api/vendor-applications"| VendorAPI["API: /api/vendor-applications"]
        
        LeadAPI --> RateLimit["In-Memory Rate Limiter (src/lib/rate-limit.ts)"]
        VendorAPI --> RateLimit
        
        RateLimit --> Sanitizer["Payload Guard & Honeypot Check"]
        Sanitizer --> Mailer["Notification Dispatcher (src/lib/mailer.ts)"]
    end

    subgraph ExternalServices ["External Integrations & Dispatch"]
        Mailer -->|"RESEND_API_KEY"| ResendAPI["Resend REST API"]
        Mailer -->|"SENDGRID_API_KEY"| SendgridAPI["SendGrid v3 API"]
        Mailer -->|"LEAD_WEBHOOK_URL"| CustomWebhook["Custom Webhook / Automation"]
        Mailer -.->|"Dev / Pending Env"| ConsoleLogger["Console Logger Fallback"]
        
        ResendAPI --> OpsTeam["care@eventsika.in (Ops & Planners)"]
        SendgridAPI --> OpsTeam
        CustomWebhook --> OpsTeam
    end
```

---

## 4. Repository / Filesystem Structure

```
landing/
├── .agents/                               # Agent configuration, memory & governance
│   ├── project-brain/
│   │   └── Brain.md                       # Central architectural source of truth
│   └── skills/                            # Specialized agent operational workflows
│       ├── code-quality-audit/SKILL.md    # Read-only code maintainability audit
│       ├── minimal-change/SKILL.md        # Surgical change discipline
│       ├── nextjs-architecture/SKILL.md   # Next.js 16 & React 19 guidelines
│       ├── pre-commit-review/SKILL.md     # Pre-commit type & lint validation
│       ├── project-memory/SKILL.md        # Memory MCP knowledge graph governance
│       └── security-audit/SKILL.md        # Evidence-based security audit
├── public/                                # Static public assets (Zero build bundling)
│   ├── images/                            # WebP/PNG photography, event types & services
│   │   ├── packages/                      # Tiered package imagery (jpg)
│   │   └── eventsika-official-logo.png    # Official brand logo asset
│   ├── payment-logos/                     # UPI, GPay, PhonePe, Paytm, Cred vector icons
│   └── videos/                            # Consultation walkthrough videos (mp4)
├── src/
│   ├── app/                               # Next.js 16 App Router hierarchy
│   │   ├── api/                           # Serverless Route Handlers
│   │   │   ├── leads/route.ts             # POST celebration lead capture
│   │   │   └── vendor-applications/route.ts # POST partner application capture
│   │   ├── diwali-consultation/           # Special 1-on-1 advisory promotion route
│   │   ├── for-vendors/                   # Vendor partner network route
│   │   ├── login/                         # Client & Partner portal login route
│   │   ├── packages/                      # Packages, comparison & customizer route
│   │   ├── services/                      # Services catalog & estimator route
│   │   ├── globals.css                    # Design tokens, CSS custom properties, resets
│   │   ├── layout.tsx                     # Root HTML shell, Google Fonts, JSON-LD Schema
│   │   ├── page.tsx                       # Homepage composition root
│   │   ├── page.module.css                # Legacy starter styles (superseded by components)
│   │   ├── robots.ts                      # Dynamic robots.txt generation
│   │   └── sitemap.ts                     # Dynamic sitemap.xml generation
│   ├── components/                        # Reusable modular UI components
│   │   ├── EventTypes.tsx / .module.css   # Interactive 2-column event showcase
│   │   ├── Footer.tsx / .module.css       # Global footer & navigation directory
│   │   ├── ForVendors.tsx / .module.css   # Homepage vendor partner section
│   │   ├── Hero.tsx / .module.css         # Hero banner & primary lead intake form
│   │   ├── HowItWorks.tsx / .module.css   # 3-step celebration process overview
│   │   ├── LoginForm.tsx / .module.css    # Portal login component & validation
│   │   ├── Navbar.tsx / .module.css       # Global header, navigation, & animated SVG logo
│   │   ├── PackageComparison.tsx / .module.css # Tier matrix comparison table
│   │   ├── PackageCustomizer.tsx / .module.css # Interactive tier customization widget
│   │   ├── Packages.tsx / .module.css     # Homepage package highlights
│   │   ├── ServiceEstimator.tsx / .module.css  # Interactive budget & guest cost estimator
│   │   ├── Services.tsx / .module.css     # Interactive 3D flip card service grid
│   │   ├── ServicesFAQ.tsx / .module.css  # Expandable service FAQ accordions
│   │   └── VendorApplicationForm.tsx / .module.css # Partner application form
│   └── lib/                               # Shared server & utility infrastructure
│       ├── mailer.ts                      # Multi-provider zero-dependency email dispatcher
│       └── rate-limit.ts                  # In-memory IP rate limiter & header extractor
├── .env.example                           # Sanitized environment variable template
├── .gitignore                             # Git ignore rules (.env.local, node_modules, .next)
├── AGENTS.md                              # Next.js 16 agent environment notice
├── CLAUDE.md                              # Pointer linking Claude to AGENTS.md
├── eslint.config.mjs                      # ESLint 9 flat configuration
├── next.config.ts                         # Next.js config (headers, reactCompiler, poweredBy)
├── package.json                           # Dependency definitions and scripts
└── tsconfig.json                          # TypeScript configuration & path aliases
```

---

## 5. Application Routing

| Route | Type | Component / File | Purpose & Key Interactions |
| :--- | :--- | :--- | :--- |
| `/` | Page (Static) | [`src/app/page.tsx`](file:///d:/Persional-projects/landing/src/app/page.tsx) | Main landing page. Contains Hero intake form (`#plan-event`), How It Works, Services, Event Types, Packages, and Vendor preview. |
| `/services` | Page (Static) | [`src/app/services/page.tsx`](file:///d:/Persional-projects/landing/src/app/services/page.tsx) | Comprehensive celebration service directory with pricing, feature breakdowns, dynamic [`ServiceEstimator`](file:///d:/Persional-projects/landing/src/components/ServiceEstimator.tsx), and [`ServicesFAQ`](file:///d:/Persional-projects/landing/src/components/ServicesFAQ.tsx). |
| `/packages` | Page (Static) | [`src/app/packages/page.tsx`](file:///d:/Persional-projects/landing/src/app/packages/page.tsx) | Curated tiered package explorer with interactive [`PackageCustomizer`](file:///d:/Persional-projects/landing/src/components/PackageCustomizer.tsx) and side-by-side [`PackageComparison`](file:///d:/Persional-projects/landing/src/components/PackageComparison.tsx). |
| `/for-vendors` | Page (Static) | [`src/app/for-vendors/page.tsx`](file:///d:/Persional-projects/landing/src/app/for-vendors/page.tsx) | Partner acquisition landing page with value props and multi-category [`VendorApplicationForm`](file:///d:/Persional-projects/landing/src/components/VendorApplicationForm.tsx). |
| `/diwali-consultation` | Page (Static) | [`src/app/diwali-consultation/page.tsx`](file:///d:/Persional-projects/landing/src/app/diwali-consultation/page.tsx) | High-intent promotional landing page for 1-on-1 strategy consultations at ₹2,999 (regular ₹5,000). |
| `/login` | Page (Static) | [`src/app/login/page.tsx`](file:///d:/Persional-projects/landing/src/app/login/page.tsx) | Client and vendor portal authentication page. Features client-side validation and simulated staging status notices. |
| `/robots.txt` | Metadata | [`src/app/robots.ts`](file:///d:/Persional-projects/landing/src/app/robots.ts) | Dynamic SEO robot instructions allowing all crawling except `/api/` endpoints. |
| `/sitemap.xml` | Metadata | [`src/app/sitemap.ts`](file:///d:/Persional-projects/landing/src/app/sitemap.ts) | Dynamic XML sitemap indexing all canonical public routes with priority ratings. |
| `/api/leads` | API (Dynamic) | [`src/app/api/leads/route.ts`](file:///d:/Persional-projects/landing/src/app/api/leads/route.ts) | POST endpoint for celebration inquiries. Rate limited, size capped, honeypot protected, dispatches email to `care@eventsika.in`. |
| `/api/vendor-applications` | API (Dynamic) | [`src/app/api/vendor-applications/route.ts`](file:///d:/Persional-projects/landing/src/app/api/vendor-applications/route.ts) | POST endpoint for vendor partner applications. Rate limited, validates portfolio URLs & category arrays, dispatches email. |

---

## 6. Frontend Architecture

### 1. Server vs. Client Component Boundaries
- **Server Components (RSC)**: All route entrypoints (`page.tsx`), `RootLayout`, `robots.ts`, `sitemap.ts`, `HowItWorks.tsx`, `Packages.tsx`, `ForVendors.tsx`, and `Footer.tsx` render as Server Components with zero hydration cost.
- **Client Components (`"use client"`)**:
  - [`Hero.tsx`](file:///d:/Persional-projects/landing/src/components/Hero.tsx): Multi-field form state, real-time Indian phone validation (`/^[6-9]\d{9}$/`), service multi-selection chips, submission spinner, and error banners.
  - [`Navbar.tsx`](file:///d:/Persional-projects/landing/src/components/Navbar.tsx): Mobile toggle menu state, active route highlighting via `usePathname()`.
  - [`Services.tsx`](file:///d:/Persional-projects/landing/src/components/Services.tsx): 3D CSS flip-card state (`transform-style: preserve-3d`) toggled via click or keyboard navigation (`Enter` / `Space`).
  - [`EventTypes.tsx`](file:///d:/Persional-projects/landing/src/components/EventTypes.tsx): Synchronized hover/click tab list updating active high-resolution editorial imagery on the left column.
  - [`PackageCustomizer.tsx`](file:///d:/Persional-projects/landing/src/components/PackageCustomizer.tsx) & [`ServiceEstimator.tsx`](file:///d:/Persional-projects/landing/src/components/ServiceEstimator.tsx): Dynamic arithmetic cost calculations based on guest counts, venue types, and add-on toggles.
  - [`VendorApplicationForm.tsx`](file:///d:/Persional-projects/landing/src/components/VendorApplicationForm.tsx) & [`LoginForm.tsx`](file:///d:/Persional-projects/landing/src/components/LoginForm.tsx): Controlled inputs, field-level error validation, and interactive feedback notices.

### 2. Styling Strategy
- **Vanilla CSS Modules**: Every component is paired with a strictly scoped `.module.css` stylesheet. Class names are hashed by Next.js to eliminate global namespace collisions.
- **Design Tokens**: Standardized CSS custom properties in `src/app/globals.css` provide uniform colors, borders, max widths, and font stacks across all components.

---

## 7. Backend Architecture

### Route Handlers & Processing Flow
The backend operates entirely through serverless Next.js Route Handlers in `src/app/api/`:

1. **Rate Limiting Check**:
   - Evaluated via `checkRateLimit(request, namespace, options)` in [`src/lib/rate-limit.ts`](file:///d:/Persional-projects/landing/src/lib/rate-limit.ts).
   - Standard limit: 5 requests per 10-minute sliding window per IP address.
   - Extracts real IP prioritizing `x-real-ip` -> `x-forwarded-for` (first entry) -> fallback `127.0.0.1`.
   - Rejection returns HTTP `429 Too Many Requests` with `Retry-After` headers.
2. **Payload Size Guard**:
   - Inspects `content-length` header. Rejects any request exceeding `51,200 bytes` (50 KB) with HTTP `413 Payload Too Large`.
3. **Automated Bot Honeypot Check**:
   - Forms include a hidden `honeypot` text field hidden from real users via CSS.
   - If a bot populates this field, the server silently returns HTTP `200 OK` without executing downstream mailers or logging.
4. **Server-Side Input Sanitization & Validation**:
   - Strips non-digit characters from phone numbers and verifies against standard 10-digit Indian mobile formats (`/^[6-9]\d{9}$/` or prefixed with `+91`/`0`).
   - Validates email strings against RFC-compliant regex patterns.
   - Restricts text field lengths (e.g. name ≤ 100 chars, business name ≤ 150 chars).
   - Enforces required service category selections.
5. **Zero-Dependency Transactional Mailer (`src/lib/mailer.ts`)**:
   - Generates responsive, brand-styled HTML email tables alongside clean plaintext fallbacks.
   - Uses native `fetch` to dispatch emails via **Resend REST API** (`https://api.resend.com/emails`) or **SendGrid v3 API** (`https://api.sendgrid.com/v3/mail/send`).
   - Supports optional JSON forwarding via **Custom Webhooks** (`LEAD_WEBHOOK_URL`).
   - Features development fallback logging to server stdout when email environment variables are unconfigured.

---

## 8. Database Architecture

* **Current Status**: **No persistent database engine** (PostgreSQL, MongoDB, MySQL, SQLite, Prisma, Drizzle) is currently installed or configured.
* **Data Flow**: Eventsika operates on an **event-driven transactional dispatch model**. Form submissions are captured, validated, and instantly transmitted to the operations team at `care@eventsika.in`.
* **Future Extension**: When user authentication, booking states, or vendor catalogs require database storage, an ORM (such as Prisma or Drizzle) and database client can be integrated directly inside Route Handlers without breaking existing UI contracts.

---

## 9. Authentication & Authorization

* **Current Status**: **Presentation Simulation Portal**.
* **Route**: [`/login`](file:///d:/Persional-projects/landing/src/app/login/page.tsx) and component [`LoginForm.tsx`](file:///d:/Persional-projects/landing/src/components/LoginForm.tsx).
* **Behavior**: 
  - Validates client-side input formats (email/phone structure, minimum 6-character password).
  - Simulates a 400ms verification delay.
  - Displays an informative status notice: *"Login functionality will be available soon. The Eventsika client & vendor portal is currently undergoing final staging."*
  - Provides direct operational routing to `care@eventsika.in` and `+91 78766 66056`.
  - Includes interactive info banners for "Forgot Password?" and "Sign Up".
* **Security Note**: No actual passwords, tokens, cookies, or user credentials are transmitted or persisted over the network.

---

## 10. Security Architecture

### 1. HTTP Security Headers
Configured globally in [`next.config.ts`](file:///d:/Persional-projects/landing/next.config.ts) for all routes `/(.*)`:
- `X-Frame-Options: SAMEORIGIN` (Defends against clickjacking attacks)
- `X-Content-Type-Options: nosniff` (Prevents MIME-type sniffing vulnerabilities)
- `Referrer-Policy: strict-origin-when-cross-origin` (Protects user privacy on cross-origin requests)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` (Restricts unauthorized browser hardware access)
- `poweredByHeader: false` (Suppresses `X-Powered-By: Next.js` fingerprinting)

### 2. XSS & Injection Defenses
- All dynamic fields interpolated into HTML emails in [`mailer.ts`](file:///d:/Persional-projects/landing/src/lib/mailer.ts) pass through `escapeHtml()` replacing `&`, `<`, `>`, `"`, and `'`.
- Schema.org JSON-LD scripts in [`layout.tsx`](file:///d:/Persional-projects/landing/src/app/layout.tsx) use native `JSON.stringify` serialization with static object constants.

### 3. Secrets Management
- **Zero Secrets in Source Code**: No private API keys or credentials exist in git.
- **Server Scoping**: All API keys (`RESEND_API_KEY`, `SENDGRID_API_KEY`, `LEAD_WEBHOOK_URL`) are read exclusively in server execution contexts (`mailer.ts`) and never prefixed with `NEXT_PUBLIC_`.
- **Git Ignore**: `.env.local` is strictly excluded in `.gitignore`.

---

## 11. Design System & Brand Guidelines

### 1. Color Palette (Verified Tokens from `globals.css`)

| Variable Name | Hex Code | Purpose / Application |
| :--- | :--- | :--- |
| `--primary` | `#7F1010` | **Eventsika Crimson / Royal Maroon**. Primary CTA buttons, focus rings, brand badges. |
| `--primary-dark` | `#5F0808` | Dark Crimson. Active hover states, deep contrast buttons. |
| `--background` / `--cream` | `#F8F3EC` | **Eventsika Cream**. Primary page background, card surfaces. |
| `--cream-light` | `#FFFAF4` | **Warm Ivory**. Navbar background, elevated card containers, form backgrounds. |
| `--foreground` | `#2B211D` | **Deep Charcoal / Espresso**. Primary typography, deep header backgrounds. |
| `--gold` | `#B99A67` | **Festive Gold**. Subheadings, eyebrow badges, logo accents, pricing highlights. |
| `--border` | `#DFD2C3` | **Neutral Sand Border**. Dividers, card borders, form input outlines. |

### 2. Typography
- **Headings & Editorial Display**: `Playfair Display` serif font loaded via `var(--font-playfair)` with high typographic hierarchy (`clamp(2rem, 5vw, 3.5rem)`).
- **Body & Interface**: `Inter` sans-serif font loaded via `var(--font-inter)` (`font-weight: 400, 500, 600, 700`).

### 3. Logo Animation & Brand Rules
- **Direct SVG Fill Transitions**: Defined in [`Navbar.module.css`](file:///d:/Persional-projects/landing/src/components/Navbar.module.css). The logo uses vector paths with `transition: fill 0.3s cubic-bezier(0.25, 1, 0.5, 1)` transitioning from Festive Gold to Crimson on hover.
- **Emblem Rotation**: The circular emblem (`.logoSymbol`) rotates 180° on brand hover around its verified coordinate origin (`transform-origin: 152.13px 253.98px`).
- **Stationary Wordmark**: The text portion (`.logoWordmark`) remains completely stationary.
- **Rejected Pattern**: Filter-based hue rotation (`filter: hue-rotate(...)`) is permanently rejected due to rainbow color interpolation artifacts.

---

## 12. Public Assets Map

All static assets reside in `public/` and are referenced using root-relative paths:

| Asset Path | Category | Usage / Location in Application |
| :--- | :--- | :--- |
| `/images/eventsika-official-logo.png` | Brand | High-resolution brand logo used in `LoginForm.tsx` and JSON-LD schema |
| `/images/eventsika-official-logo.svg` | Brand | Scalable vector logo asset |
| `/images/service-venue-decor.webp` | Services | Service card 01 (Venue Decor) in `Services.tsx` & `services/page.tsx` |
| `/images/service-catering.webp` | Services | Service card 02 (Gourmet Catering) in `Services.tsx` & `services/page.tsx` |
| `/images/service-photography.webp` | Services | Service card 03 (Photography & Films) |
| `/images/service-entertainment.webp` | Services | Service card 04 (Entertainment & Performers) |
| `/images/service-event-management.webp` | Services | Service card 05 (Event Coordination) |
| `/images/service-invitations-details.webp`| Services | Service card 06 (Invitations & Stationery) |
| `/images/event-diwali.webp` | Event Types | Event showcase 01 (Diwali Celebrations) in `EventTypes.tsx` |
| `/images/event-birthday.webp.png` | Event Types | Event showcase 02 (Birthdays) |
| `/images/event-anniversary.webp.png` | Event Types | Event showcase 03 (Anniversaries) |
| `/images/event-housewarming.webp` | Event Types | Event showcase 04 (Housewarming / Griha Pravesh) |
| `/images/event-baby-shower.webp` | Event Types | Event showcase 05 (Baby Showers / Godh Bharai) |
| `/images/event-satsang-puja.webp` | Event Types | Event showcase 06 (Satsang & Puja Ceremonies) |
| `/images/event-festive-party.webp` | Event Types | Event showcase 07 (Festive Galas) |
| `/images/event-family-dinner.webp` | Event Types | Event showcase 08 (Intimate Family Dinners) |
| `/images/packages/balcony-terrace.jpg` | Packages | Balcony / Terrace package card in `packages/page.tsx` |
| `/images/packages/driveway-lawns.jpg` | Packages | Driveway / Lawns package card |
| `/images/packages/grand-celebration.jpg` | Packages | Grand Celebration package card |
| `/images/packages/living-room-dinner.jpg` | Packages | Living Room Dinner package card |
| `/images/packages/showroom-office.jpg` | Packages | Showroom & Office Launch package card |
| `/images/packages/small-budget-wedding.jpg`| Packages | Small Budget Wedding package card |
| `/images/vendor-network-final.webp` | Vendors | Editorial photography for `ForVendors.tsx` & `/for-vendors` |
| `/payment-logos/*.svg` | Payment | UPI, GPay, PhonePe, Paytm, Amazon Pay, Cred icons |
| `/videos/eventsika-consultation-process.mp4` | Video | Consultation process video demonstration |

---

## 13. Major User Flows

```mermaid
sequenceDiagram
    autonumber
    actor User as Client / Event Host
    participant UI as Eventsika Frontend (Hero / Forms)
    participant API as Route Handler (/api/leads)
    participant Sec as Security (Rate Limit & Honeypot)
    participant Mail as Mailer Utility (mailer.ts)
    participant Inbox as Operations (care@eventsika.in)

    User->>UI: Fills celebration details (Name, Phone, City, Occasion, Guests, Budget)
    User->>UI: Clicks "Plan Your Celebration"
    UI->>UI: Performs client validation (Indian mobile regex, required fields)
    UI->>API: POST /api/leads with JSON payload
    API->>Sec: Check IP Rate Limit (Max 5 / 10 min)
    alt Rate Limit Exceeded
        Sec-->>UI: HTTP 429 (Retry-After)
        UI-->>User: "Too many submission attempts. Please wait..."
    else Allowed
        API->>Sec: Validate Honeypot
        alt Bot Detected
            Sec-->>UI: HTTP 200 OK (Silent Drop)
        else Legitimate Client
            API->>Mail: sendNotificationEmail(leadPayload)
            Mail->>Inbox: Dispatch formatted HTML email via Resend / SendGrid
            Mail-->>API: { success: true, delivered: true }
            API-->>UI: HTTP 200 { success: true }
            UI-->>User: Success confirmation screen & WhatsApp booking notice
        end
    end
```

---

## 14. External Services & Integrations

* **Email Provider Dispatchers**:
  * **Resend API**: Triggered when `RESEND_API_KEY` is present. Posts to `https://api.resend.com/emails`.
  * **SendGrid v3 API**: Triggered when `SENDGRID_API_KEY` is present. Posts to `https://api.sendgrid.com/v3/mail/send`.
  * **Custom Automation Webhooks**: Triggered when `LEAD_WEBHOOK_URL` is set (Make, Zapier, Telegram bot, Hostinger webhook).
* **Schema.org Structured Data**:
  * JSON-LD Organization, WebSite, and BreadcrumbList schemas injected on public routes for rich Google search cards.
* **Operational Inboxes**: All customer leads and vendor applications route to `care@eventsika.in`.

---

## 15. Deployment & Infrastructure

* **Deployment Options**:
  * **Hostinger / Node.js VPS / Standalone Server**: Built via `npm run build` using Next.js standalone output. Pre-packaged production deployment archives (`eventsika-hostinger-production.zip`, `eventsika-standalone-production.zip`) exist in project root.
  * **Vercel / Edge Serverless**: Native zero-configuration deployment.
* **Environment Variables Configuration**:
  ```env
  # Target recipient for leads & applications
  NOTIFICATION_EMAIL=care@eventsika.in

  # Verified sender email address
  EMAIL_FROM="Eventsika Leads <care@eventsika.in>"

  # Option 1: Resend API Key (Recommended)
  RESEND_API_KEY=re_...

  # Option 2: SendGrid API Key
  SENDGRID_API_KEY=SG....

  # Option 3: Custom Webhook URL
  LEAD_WEBHOOK_URL=https://...
  ```

---

## 16. Git & Development Workflow

* **Primary Branch**: `main`
* **Development Scripts**:
  - `npm run dev`: Starts local Next.js development server with Turbopack on `http://localhost:3000`.
  - `npm run build`: Executes production build and type-checking.
  - `npm run start`: Starts production standalone server.
  - `npm run lint`: Runs ESLint 9 checks (`eslint-config-next`).
* **Pre-Commit Verification**: Always run `npx tsc --noEmit` and `npm run lint` before committing any code changes.

---

## 17. Existing Agent & AI Tooling

The Eventsika development environment is integrated with specialized Model Context Protocol (MCP) servers and IDE tools:

| MCP / Tool | Configuration / Endpoint | Purpose in Eventsika Workflow |
| :--- | :--- | :--- |
| **Memory MCP** | `@modelcontextprotocol/server-memory` | Local, persistent knowledge graph (`memory.jsonl`) storing durable decisions and architecture facts. |
| **Context7 MCP** | `https://mcp.context7.com/mcp` | Real-time official documentation lookup for Next.js 16, React 19, and modern web standards. |
| **Google Stitch MCP** | `@_davideast/stitch-mcp` | Design system exploration, UI mockup generation, and layout variant synthesis. |
| **GitHub MCP** | `@modelcontextprotocol/server-github` | Read-only repository inspection, commit history analysis, issue and PR tracking. |
| **Chrome DevTools Plugin**| `@ChromeDevTools/chrome-devtools-mcp`| Deep DOM inspection, Lighthouse audit, and Puppeteer-based performance evaluation. |
| **Native Browser Agent** | `browser_subagent` (Built-in) | Interactive browser automation, screenshot capture, and automatic WebP recording. |

---

## 18. Project Skills

The repository includes 6 purpose-built skills located in [`.agents/skills/`](file:///d:/Persional-projects/landing/.agents/skills):

1. **[`minimal-change`](file:///d:/Persional-projects/landing/.agents/skills/minimal-change/SKILL.md)**: Enforces surgical precision, root-cause diagnosis first, smallest possible diffs, and zero collateral refactoring.
2. **[`pre-commit-review`](file:///d:/Persional-projects/landing/.agents/skills/pre-commit-review/SKILL.md)**: Governs structured read-only working tree audits, diff checks, `tsc --noEmit` validation, and ESLint verification before committing.
3. **[`code-quality-audit`](file:///d:/Persional-projects/landing/.agents/skills/code-quality-audit/SKILL.md)**: Read-only maintainability, complexity, dead-code, and technical debt assessment.
4. **[`security-audit`](file:///d:/Persional-projects/landing/.agents/skills/security-audit/SKILL.md)**: Evidence-based security audits of Route Handlers, input bounds, rate limiting, and secret leakage vectors.
5. **[`nextjs-architecture`](file:///d:/Persional-projects/landing/.agents/skills/nextjs-architecture/SKILL.md)**: Authoritative guidelines on Server vs. Client component boundaries, App Router patterns, and asset optimization.
6. **[`project-memory`](file:///d:/Persional-projects/landing/.agents/skills/project-memory/SKILL.md)**: Governs how the agent interacts with Memory MCP graph nodes and reconciles durable decisions with source code.

---

## 19. Key Architectural Decisions (ADRs)

| ADR ID | Decision | Reason & Context | Consequence / Standard |
| :--- | :--- | :--- | :--- |
| **ADR-01** | **Pure CSS Modules over Tailwind CSS** | Provides complete typographic control, exact bespoke color rendering, zero utility bloat, and clean component colocation. | All styling must be written in scoped `*.module.css` files using CSS custom properties. |
| **ADR-02** | **Zero-Dependency Native Email Dispatch** | External SDKs (Nodemailer, heavy client wrappers) add unnecessary bundle weight and maintenance overhead in serverless. | `mailer.ts` uses native `fetch` against Resend / SendGrid REST APIs. |
| **ADR-03** | **In-Memory Rate Limiting** | Avoids requiring external Redis/Upstash infrastructure during early production launch while mitigating brute-force abuse. | `rate-limit.ts` provides sliding window throttling with automated 5-minute cleanup cycles. |
| **ADR-04** | **Direct SVG Fill Transitions for Logo** | CSS `filter: hue-rotate()` interpolates through intermediate rainbow hues (green/blue) when transitioning gold to crimson. | Logo vector paths use explicit `transition: fill` with 180° emblem rotation and stationary wordmark. |
| **ADR-05** | **React Compiler Enabled** | Automates memoization and re-render optimizations in React 19 without manual `useMemo`/`useCallback` clutter. | Enabled via `reactCompiler: true` in `next.config.ts`. |
| **ADR-06** | **Presentation Login Portal** | Client portal dashboard is undergoing staging; users need clear guidance and immediate direct assistance rather than dead ends. | `/login` validates input and provides explicit support links to `care@eventsika.in`. |
| **ADR-07** | **Canonical WebP Asset Optimization & Lazy-Loading** | High-resolution raster images (PNGs/JPEGs) bloat initial page load. Next.js `<Image>` provides default viewport lazy-loading. | All photographic assets use high-fidelity WebP (quality ~85). Below-the-fold media uses deferred loading with poster preview frames. |

---

## 20. Protected Areas (Handle With Caution)

Do NOT modify these components or systems without explicit user approval and a detailed verification plan:
1. **[`src/lib/mailer.ts`](file:///d:/Persional-projects/landing/src/lib/mailer.ts) & [`src/lib/rate-limit.ts`](file:///d:/Persional-projects/landing/src/lib/rate-limit.ts)**: Core notification dispatch and abuse prevention infrastructure.
2. **[`next.config.ts`](file:///d:/Persional-projects/landing/next.config.ts)**: Global security headers, compiler flags, and server configurations.
3. **[`src/app/globals.css`](file:///d:/Persional-projects/landing/src/app/globals.css)**: Core brand color tokens (`--primary`, `--gold`, `--cream`, etc.) and CSS variables.
4. **SVG Logo Coordinates & Keyframes in [`Navbar.tsx`](file:///d:/Persional-projects/landing/src/components/Navbar.tsx) and [`Footer.tsx`](file:///d:/Persional-projects/landing/src/components/Footer.tsx)**: Vector geometry and rotation origins.
5. **Route Handler Input Boundaries**: Strict phone regex (`/^[6-9]\d{9}$/`), size ceilings (50 KB), and honeypot structures.

---

## 21. Safe-to-Modify Areas

These areas can be iterated on and refined with standard pre-commit verification:
1. **Marketing Copy & Headings**: Text, feature descriptions, testimonials, and FAQs across landing sections.
2. **Component-Specific Visual Styles**: Padding, margins, typography sizes, and layouts within localized `*.module.css` files.
3. **Package & Pricing Tiers**: Pricing numbers, guest ranges, and feature bullet points in `PACKAGE_TIERS` (`packages/page.tsx`).
4. **New Service Categories**: Additional items in `SERVICES_DATA` (`services/page.tsx`).
5. **New Unit or E2E Tests**: Adding test suites without touching production logic.

---

## 22. Known Issues & Technical Debt

1. **PR #1 (Open)**: Flags global `scroll-behavior: smooth` in `globals.css` vs Next.js 16 recommendation for `data-scroll-behavior="smooth"` attribute in `layout.tsx`.
2. **Legacy `page.module.css`**: Contains default boilerplate CSS from initial `create-next-app` initialization. Unused by current components but retained to avoid unnecessary breaking diffs.
3. **In-Memory Rate Limiting Scope**: Memory state is per Node process. When deployed across multiple distributed serverless instances, rate limits are enforced on a per-instance basis rather than globally (sufficient for current traffic; upgrade to Redis when scaling).

---

## 23. Completed Major Features

- [x] Full-stack Next.js 16 App Router celebration landing platform.
- [x] High-conversion interactive Hero celebration inquiry form with real-time validation.
- [x] Interactive 3D flip-card services showcase with responsive touch and keyboard support.
- [x] Dynamic 2-column interactive event occasions showcase (`EventTypes.tsx`).
- [x] Interactive Package Customizer and side-by-side Package Comparison matrix (`/packages`).
- [x] Interactive Celebration Service Cost Estimator & Accordion FAQ (`/services`).
- [x] Vendor Partner Network application form & acquisition portal (`/for-vendors`).
- [x] Seasonal 1-on-1 Strategy Session promotion landing page (`/diwali-consultation`).
- [x] Client & Partner presentation login portal (`/login`).
- [x] Zero-dependency multi-adapter notification mailer (`mailer.ts`).
- [x] In-memory sliding window IP rate limiting & honeypot anti-spam protection (`rate-limit.ts`).
- [x] Hardened HTTP security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`).
- [x] Dynamic SEO generation (`robots.ts`, `sitemap.ts`, Schema.org JSON-LD).

---

## 24. Current Project State

* **Build Health**: Clean TypeScript compilation (`0 errors`), valid ESLint 9 checks.
* **Development Server**: Fully operational and active on `http://localhost:3000`.
* **Current Operational Priority**: Maintaining rock-solid landing page performance, zero-regression changes, and pristine architectural documentation.

---

## 25. Important Constraints & Rules

1. **Minimal Change Principle**: Make the smallest safe change that completely satisfies the task. Never refactor working code outside the immediate scope.
2. **Preserve Established Patterns**: Adhere strictly to CSS Modules and CSS Custom Properties. Never introduce Tailwind CSS or heavy UI frameworks unless explicitly directed.
3. **Strict Secrets Hygiene**: Never commit or log API keys, webhook secrets, or private credentials.
4. **Code is Ground Truth**: If any documentation, memory entry, or previous prompt disagrees with the active source code, the code is always right.

---

## 26. AI Agent Operating Rules

Every AI agent working in the Eventsika repository must adhere to the following 10 Commandments:

1. **Read Brain.md First**: Consult `Brain.md` before performing any non-trivial architectural, backend, or styling task.
2. **Inspect Before Editing**: Always read the target file and understand surrounding imports and types before proposing or making an edit.
3. **Never Trust Assumptions Over Code**: Verify reality directly against repository files.
4. **Make Surgical Edits**: Modify only the exact lines necessary. Avoid touching unrelated files or reformatting working code.
5. **Do Not Invent Architecture**: Only document and utilize systems, routes, and services that actually exist.
6. **Zero Unnecessary Packages**: Never add npm dependencies if native Next.js, React, or standard Web APIs solve the problem.
7. **Protect Secrets**: Never output or commit real credentials, tokens, or environment variable values.
8. **Run Pre-Commit Checks**: Always verify TypeScript compilation (`npx tsc --noEmit`) and linting (`npm run lint`) after modifications.
9. **Update Brain.md on Major Changes**: When an architectural decision, route, or core feature is modified, update `Brain.md` immediately.
10. **Explain Before Expanding Scope**: If a broader refactor appears necessary, stop and ask the user for confirmation before proceeding.

---

## 27. Brain Maintenance Rules

`Brain.md` must be updated whenever meaningful changes occur in the project:

### MUST Update Brain.md For:
- Adding, removing, or renaming routes or pages.
- Introducing or altering backend APIs, Route Handlers, or validation rules.
- Modifying security headers, rate limiting, or mailer infrastructure.
- Adding or updating major UI components or design system color tokens.
- Making architectural decisions (ADRs) or changing third-party integrations.
- Adding or altering project skills or MCP tooling.

### Should NOT Update Brain.md For:
- Minor typo fixes or copy tweaks.
- Minor 1-line CSS spacing adjustments.
- Routine bug fixes that do not change system architecture.
- Transient local debugging experiments.

### Maintenance Workflow:
1. Make and verify the code change.
2. Update the relevant sections in `Brain.md`.
3. Add a dated entry to the Change Log in Section 28.
4. Confirm `Brain.md` matches the actual repository state.

---

## 28. Change Log

### 2026-08-31
- **Resource Optimization & Cleanup**: Converted package photography and duplicate homepage assets to high-fidelity WebP (quality 85), saving 11.57 MB (84.1% directory reduction). Added video poster preview and documented ADR-07.

### 2026-08-30
- **Created**: Initial establishment of the central Eventsika Project Brain (`Brain.md`).
- **Scope**: Comprehensive inspection and documentation of Next.js 16 App Router architecture, component hierarchy, backend Route Handlers, rate limiting, mailer dispatcher, design tokens, asset maps, security posture, and agent operating rules.
- **Sections Initialized**: Sections 0 through 29 complete.

---

## 29. Final Verification

- **Repository Inspected**: YES (All files, routes, components, and configs verified from source)
- **Architecture Verified**: YES (App Router, Server/Client boundaries, Mailer & Rate Limiter confirmed)
- **Secrets Excluded**: YES (Zero API keys, credentials, or private values included)
- **Existing Agent Tooling Preserved**: YES (All 6 skills in `.agents/skills/` and MCP configurations intact)
- **Application Code Modified**: NO (Documentation & governance task only)
- **Brain.md Generated From Actual Codebase**: YES
- **Verification Timestamp**: `2026-08-30T12:36:00+05:30`
