# Graph Report - landing  (2026-09-16)

## Corpus Check
- 152 files · ~168,304 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 786 nodes · 1693 edges · 41 communities (27 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7981c8a0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- rate-limit.ts
- vendor-service.ts
- devDependencies
- lead-schema.ts
- analytics-repository.interface.ts
- payment-and-consultation.ts
- compilerOptions
- PackageCustomizer.tsx
- VendorsWorkspace.tsx
- getSupabaseAdminClient
- app/page.tsx
- AdminShell.tsx
- services/page.tsx
- for-vendors/page.tsx
- diwali-consultation/page.tsx
- Hero.tsx
- DiwaliLights.tsx
- cashfree-payment-gateway-adapter.ts
- middleware
- app/layout.tsx
- RequestDeduplicator
- BackendLogger
- next.config.ts
- login/page.tsx
- PaymentTransactionRecord
- eslint.config.mjs
- Eventsika Server & Client Architecture
- Eventsika Platform Overview
- Graphify Knowledge Graph Rules
- Curated Vendor Network
- Minimal Change Protocol
- Pre-Commit Review Protocol
- PaymentRefundRecord
- PaymentOrderRecord
- payment-foundation-repositories.test.ts
- packages/page.tsx
- consultation-schema.ts
- Navbar.tsx

## God Nodes (most connected - your core abstractions)
1. `getSupabaseAdminClient()` - 33 edges
2. `ConsultationSlotRecord` - 21 edges
3. `ValidatedLeadInput` - 21 edges
4. `logger` - 17 edges
5. `SupabaseConsultationSlotRepository` - 17 edges
6. `ValidatedVendorInput` - 17 edges
7. `IConsultationSlotRepository` - 16 edges
8. `compilerOptions` - 16 edges
9. `SavedLeadRecord` - 15 edges
10. `ILeadRepository` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Repository Pattern & Storage Abstraction` --references--> `getDefaultLeadRepository()`  [EXTRACTED]
  .agents/project-brain/Brain.md → src/lib/backend/services/lead-service.ts
- `Reverse-Proxy & Ingress Trust Assumptions` --rationale_for--> `getClientIp()`  [EXTRACTED]
  README.md → src/lib/rate-limit.ts
- `Tiered Rate Limiting Architecture` --references--> `checkAdminLoginRateLimit()`  [EXTRACTED]
  .agents/project-brain/Brain.md → src/lib/rate-limit.ts
- `Fail-Closed Security Policy` --rationale_for--> `checkAdminLoginRateLimit()`  [EXTRACTED]
  README.md → src/lib/rate-limit.ts
- `Concierge Operations Suite` --references--> `middleware()`  [EXTRACTED]
  .agents/project-brain/Brain.md → src/middleware.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Celebration Lead Intake Pipeline** — agents_project_brain_brain_intake_pipeline, src_lib_backend_services_lead_service_leadservice, src_lib_rate_limit_checkratelimit [INFERRED 0.95]
- **Security & Ingress Perimeter** — src_middleware_middleware, src_lib_rate_limit_getclientip, readme_reverse_proxy_trust, agents_skills_security_audit_skill_security_audit [INFERRED 0.95]

## Communities (41 total, 11 thin omitted)

### Community 0 - "rate-limit.ts"
Cohesion: 0.05
Nodes (55): Tiered Rate Limiting Architecture, Fail-Closed Security Policy, Reverse-Proxy & Ingress Trust Assumptions, DELETE(), GET(), POST(), PUT(), DELETE() (+47 more)

### Community 1 - "vendor-service.ts"
Cohesion: 0.07
Nodes (37): VENDOR_CATEGORIES, VENDOR_EXPERIENCE_TIERS, VendorCategoryOption, VendorExperienceTier, deduplicator, generateLeadDeduplicationKey(), generateVendorDeduplicationKey(), DeliveryResult (+29 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (44): Next.js 16 Breaking Changes Directives, babel-plugin-react-compiler, Claude Agent Steering Pointer, eslint, eslint-config-next, @lottiefiles/dotlottie-web, next, dependencies (+36 more)

### Community 3 - "lead-schema.ts"
Cohesion: 0.07
Nodes (41): Celebration Intake Pipeline, Repository Pattern & Storage Abstraction, cleanIndianPhone(), formatDisplayDate(), formatDisplayDateTime(), isRecentSubmission(), LeadsWorkspace(), LeadsWorkspaceProps (+33 more)

### Community 4 - "analytics-repository.interface.ts"
Cohesion: 0.09
Nodes (27): AnalyticsWorkspace(), AnalyticsWorkspaceProps, TABS, CITY_GEO_COORDINATES, IndiaDemandMap(), IndiaDemandMapProps, INDIA_MAP_STATES, INDIA_MAP_VIEWBOX (+19 more)

### Community 5 - "payment-and-consultation.ts"
Cohesion: 0.06
Nodes (47): dynamic, IConsultationRepository, IConsultationSlotRepository, SupabaseConsultationRepository, SupabaseConsultationSlotRepository, ConsultationBookingService, AvailableSlotDto, CONSULTATION_BUFFER_MINUTES (+39 more)

### Community 6 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 7 - "PackageCustomizer.tsx"
Cohesion: 0.23
Nodes (13): PackageCustomizer(), PackageCustomizerProps, HOME_PACKAGE_PRESENTATION, HomePackagePresentation, Packages(), AddonConfig, ADDONS_CONFIG, DEFAULT_GUEST_COUNT (+5 more)

### Community 8 - "VendorsWorkspace.tsx"
Cohesion: 0.19
Nodes (17): metadata, RFC-4180, buildVendorCsvContent(), cleanIndianPhone(), formatDisplayDate(), formatDisplayDateTime(), sanitizeCsvCell(), sanitizeEmailForMailto() (+9 more)

### Community 9 - "getSupabaseAdminClient"
Cohesion: 0.10
Nodes (13): AdminDashboardPage(), getInitials(), metadata, DashboardData, DashboardMetrics, IDashboardRepository, RecentActivityItem, RecentActivityType (+5 more)

### Community 10 - "app/page.tsx"
Cohesion: 0.21
Nodes (7): EVENT_TYPES, EventTypes(), BENEFITS, ForVendors(), HowItWorks(), STEPS, Services

### Community 11 - "AdminShell.tsx"
Cohesion: 0.18
Nodes (10): AdminHeader(), AdminHeaderProps, AdminShell(), AdminShellProps, AdminSidebar(), AdminLayout(), metadata, AdminAuthResult (+2 more)

### Community 12 - "services/page.tsx"
Cohesion: 0.18
Nodes (9): breadcrumbJsonLd, metadata, SERVICES_DATA, ESTIMATOR_OPTIONS, EstimatorOption, ServiceEstimator(), FAQ_DATA, FAQItem (+1 more)

### Community 13 - "for-vendors/page.tsx"
Cohesion: 0.18
Nodes (9): breadcrumbJsonLd, metadata, PARTNER_CATEGORIES, VENDOR_BENEFITS, FormData, FormErrors, INITIAL_FORM_DATA, SERVICE_CATEGORIES (+1 more)

### Community 14 - "diwali-consultation/page.tsx"
Cohesion: 0.15
Nodes (9): BENEFITS_DATA, CHECKLIST_ITEMS, INCLUSIONS_DATA, metadata, STEPS_DATA, TESTIMONIALS_DATA, EXPLORE_LINKS, Footer() (+1 more)

### Community 15 - "Hero.tsx"
Cohesion: 0.22
Nodes (9): BUDGET_OPTIONS, CITY_OPTIONS, EVENT_TYPE_OPTIONS, GUEST_COUNT_OPTIONS, Hero(), isValidPhoneNumber(), SERVICE_OPTIONS, VENUE_TYPE_OPTIONS (+1 more)

### Community 16 - "DiwaliLights.tsx"
Cohesion: 0.16
Nodes (10): DiwaliCtaDiya(), DiwaliLights(), DIYA_LIGHTS, DiyaLight, GOLDEN_DOTS, GoldenDot, ACTIVE_SEASONAL_OCCASION, SeasonalDecoration() (+2 more)

### Community 17 - "cashfree-payment-gateway-adapter.ts"
Cohesion: 0.15
Nodes (16): assertProductionEnv(), CashfreeConfig, EnvValidationResult, getServerConfig(), isNonEmptyString(), ServerConfig, validateServerEnv(), CashfreePaymentGatewayAdapter (+8 more)

### Community 18 - "middleware"
Cohesion: 0.33
Nodes (5): Concierge Operations Suite, Security Audit Protocol, mockGetUser, config, middleware()

### Community 19 - "app/layout.tsx"
Cohesion: 0.33
Nodes (4): inter, jsonLd, metadata, playfair

### Community 24 - "PaymentTransactionRecord"
Cohesion: 0.24
Nodes (6): IPaymentTransactionRepository, SupabasePaymentTransactionRepository, CreatePaymentTransactionInput, PaymentMethod, PaymentTransactionRecord, PaymentTransactionStatus

### Community 35 - "PaymentRefundRecord"
Cohesion: 0.28
Nodes (6): IPaymentRefundRepository, SupabasePaymentRefundRepository, CreatePaymentRefundInput, PaymentRefundRecord, PaymentRefundStatus, RefundInitiator

### Community 36 - "PaymentOrderRecord"
Cohesion: 0.31
Nodes (5): IPaymentOrderRepository, SupabasePaymentOrderRepository, CreatePaymentOrderInput, PaymentOrderRecord, PaymentOrderStatus

### Community 37 - "payment-foundation-repositories.test.ts"
Cohesion: 0.32
Nodes (5): SupabaseWebhookEventRepository, IWebhookEventRepository, CreateWebhookEventInput, WebhookEventRecord, WebhookEventStatus

### Community 38 - "packages/page.tsx"
Cohesion: 0.18
Nodes (9): breadcrumbJsonLd, metadata, PACKAGE_TIERS, packagesJsonLd, PackageTier, COMPARISON_DATA, ComparisonCategory, ComparisonItem (+1 more)

### Community 39 - "consultation-schema.ts"
Cohesion: 0.25
Nodes (7): RFC-5321, MEETING_CHANNELS, ConsultationValidationResult, RawConsultationInput, validateConsultationInput(), PhoneValidationResult, validateIndianPhone()

### Community 40 - "Navbar.tsx"
Cohesion: 0.24
Nodes (7): AdminSidebarProps, NavItem, LogoutButton(), LogoutButtonProps, EventsikaLogo(), NAV_LINKS, Navbar()

## Knowledge Gaps
- **200 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+195 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 251 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `logger` connect `lead-schema.ts` to `rate-limit.ts`, `vendor-service.ts`, `analytics-repository.interface.ts`, `payment-and-consultation.ts`, `getSupabaseAdminClient`, `cashfree-payment-gateway-adapter.ts`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **Why does `createSupabaseServerClient()` connect `rate-limit.ts` to `AdminShell.tsx`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Why does `requireAdminSession()` connect `AdminShell.tsx` to `rate-limit.ts`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _200 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `rate-limit.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05005107252298264 - nodes in this community are weakly interconnected._
- **Should `vendor-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06935908691834942 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._