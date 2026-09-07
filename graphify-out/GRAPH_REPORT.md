# Graph Report - landing  (2026-09-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 536 nodes · 1005 edges · 34 communities (21 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6dd45290`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- rate-limit.ts
- vendor-service.ts
- lead-service.ts
- devDependencies
- lead-schema.ts
- compilerOptions
- packages/page.tsx
- VendorsWorkspace.tsx
- AdminSidebar.tsx
- admin-dashboard-service.ts
- for-vendors/page.tsx
- diwali-consultation/page.tsx
- app/page.tsx
- DiwaliLights.tsx
- services/page.tsx
- deduplicator.ts
- Hero.tsx
- mailer.ts
- env.ts
- middleware
- app/layout.tsx
- BackendLogger
- next.config.ts
- login/page.tsx
- eslint.config.mjs
- Eventsika Server & Client Architecture
- Eventsika Platform Overview
- Graphify Knowledge Graph Rules
- Curated Vendor Network
- Minimal Change Protocol
- Pre-Commit Review Protocol

## God Nodes (most connected - your core abstractions)
1. `ValidatedLeadInput` - 17 edges
2. `compilerOptions` - 16 edges
3. `ILeadRepository` - 15 edges
4. `IVendorRepository` - 14 edges
5. `SavedLeadRecord` - 14 edges
6. `ValidatedVendorInput` - 13 edges
7. `IDeliveryNotifier` - 12 edges
8. `getSupabaseAdminClient()` - 12 edges
9. `logger` - 12 edges
10. `UpstashRedisRateLimitStore` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Tiered Rate Limiting Architecture` --references--> `checkAdminLoginRateLimit()`  [EXTRACTED]
  .agents/project-brain/Brain.md → src/lib/rate-limit.ts
- `Fail-Closed Security Policy` --rationale_for--> `checkAdminLoginRateLimit()`  [EXTRACTED]
  README.md → src/lib/rate-limit.ts
- `Reverse-Proxy & Ingress Trust Assumptions` --rationale_for--> `getClientIp()`  [EXTRACTED]
  README.md → src/lib/rate-limit.ts
- `Repository Pattern & Storage Abstraction` --references--> `getDefaultLeadRepository()`  [EXTRACTED]
  .agents/project-brain/Brain.md → src/lib/backend/services/lead-service.ts
- `Concierge Operations Suite` --references--> `middleware()`  [EXTRACTED]
  .agents/project-brain/Brain.md → src/middleware.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Celebration Lead Intake Pipeline** — agents_project_brain_brain_intake_pipeline, src_lib_backend_services_lead_service_leadservice, src_lib_rate_limit_checkratelimit [INFERRED 0.95]
- **Security & Ingress Perimeter** — src_middleware_middleware, src_lib_rate_limit_getclientip, readme_reverse_proxy_trust, agents_skills_security_audit_skill_security_audit [INFERRED 0.95]

## Communities (34 total, 10 thin omitted)

### Community 0 - "rate-limit.ts"
Cohesion: 0.05
Nodes (48): Tiered Rate Limiting Architecture, Fail-Closed Security Policy, Reverse-Proxy & Ingress Trust Assumptions, DELETE(), GET(), POST(), PUT(), DELETE() (+40 more)

### Community 1 - "vendor-service.ts"
Cohesion: 0.09
Nodes (25): VendorCategoryOption, VendorExperienceTier, DeliveryResult, IDeliveryNotifier, defaultDeliveryNotifier, MailerDeliveryNotifier, maskPhone(), defaultVendorRepository (+17 more)

### Community 2 - "lead-service.ts"
Cohesion: 0.09
Nodes (25): Repository Pattern & Storage Abstraction, cleanIndianPhone(), formatDisplayDate(), formatDisplayDateTime(), isRecentSubmission(), LeadsWorkspace(), LeadsWorkspaceProps, renderServiceIcon() (+17 more)

### Community 3 - "devDependencies"
Cohesion: 0.05
Nodes (42): Next.js 16 Breaking Changes Directives, babel-plugin-react-compiler, Claude Agent Steering Pointer, eslint, eslint-config-next, next, dependencies, next (+34 more)

### Community 4 - "lead-schema.ts"
Cohesion: 0.12
Nodes (22): Celebration Intake Pipeline, BUDGET_OPTIONS, BudgetOption, CITY_OPTIONS, CityOption, EVENT_TYPE_OPTIONS, EventTypeOption, GUEST_COUNT_OPTIONS (+14 more)

### Community 5 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 6 - "packages/page.tsx"
Cohesion: 0.12
Nodes (21): breadcrumbJsonLd, metadata, PACKAGE_TIERS, packagesJsonLd, PackageTier, COMPARISON_DATA, ComparisonCategory, ComparisonItem (+13 more)

### Community 7 - "VendorsWorkspace.tsx"
Cohesion: 0.19
Nodes (17): metadata, RFC-4180, buildVendorCsvContent(), cleanIndianPhone(), formatDisplayDate(), formatDisplayDateTime(), sanitizeCsvCell(), sanitizeEmailForMailto() (+9 more)

### Community 8 - "AdminSidebar.tsx"
Cohesion: 0.12
Nodes (15): AdminHeader(), AdminHeaderProps, AdminShell(), AdminShellProps, AdminSidebar(), AdminSidebarProps, NavItem, AdminLayout() (+7 more)

### Community 9 - "admin-dashboard-service.ts"
Cohesion: 0.17
Nodes (12): AdminDashboardPage(), getInitials(), metadata, DashboardData, DashboardMetrics, IDashboardRepository, RecentActivityItem, RecentActivityType (+4 more)

### Community 10 - "for-vendors/page.tsx"
Cohesion: 0.15
Nodes (11): breadcrumbJsonLd, metadata, PARTNER_CATEGORIES, VENDOR_BENEFITS, NAV_LINKS, Navbar(), FormData, FormErrors (+3 more)

### Community 11 - "diwali-consultation/page.tsx"
Cohesion: 0.15
Nodes (9): BENEFITS_DATA, CHECKLIST_ITEMS, INCLUSIONS_DATA, metadata, STEPS_DATA, TESTIMONIALS_DATA, EXPLORE_LINKS, Footer() (+1 more)

### Community 12 - "app/page.tsx"
Cohesion: 0.19
Nodes (8): EVENT_TYPES, EventTypes(), BENEFITS, ForVendors(), HowItWorks(), STEPS, Packages(), Services

### Community 13 - "DiwaliLights.tsx"
Cohesion: 0.16
Nodes (10): DiwaliCtaDiya(), DiwaliLights(), DIYA_LIGHTS, DiyaLight, GOLDEN_DOTS, GoldenDot, ACTIVE_SEASONAL_OCCASION, SeasonalDecoration() (+2 more)

### Community 14 - "services/page.tsx"
Cohesion: 0.18
Nodes (9): breadcrumbJsonLd, metadata, SERVICES_DATA, ESTIMATOR_OPTIONS, EstimatorOption, ServiceEstimator(), FAQ_DATA, FAQItem (+1 more)

### Community 15 - "deduplicator.ts"
Cohesion: 0.25
Nodes (4): deduplicator, generateLeadDeduplicationKey(), generateVendorDeduplicationKey(), RequestDeduplicator

### Community 16 - "Hero.tsx"
Cohesion: 0.25
Nodes (8): BUDGET_OPTIONS, CITY_OPTIONS, EVENT_TYPE_OPTIONS, GUEST_COUNT_OPTIONS, Hero(), isValidPhoneNumber(), SERVICE_OPTIONS, VENUE_TYPE_OPTIONS

### Community 17 - "mailer.ts"
Cohesion: 0.39
Nodes (8): escapeHtml(), generateHtmlEmail(), generatePlainText(), LeadEmailPayload, maskEmailForLogs(), maskPhoneForLogs(), sanitizeDataForSafeLog(), sendNotificationEmail()

### Community 18 - "env.ts"
Cohesion: 0.46
Nodes (6): assertProductionEnv(), EnvValidationResult, getServerConfig(), isNonEmptyString(), ServerConfig, validateServerEnv()

### Community 19 - "middleware"
Cohesion: 0.33
Nodes (5): Concierge Operations Suite, Security Audit Protocol, mockGetUser, config, middleware()

### Community 20 - "app/layout.tsx"
Cohesion: 0.33
Nodes (4): inter, jsonLd, metadata, playfair

## Knowledge Gaps
- **167 isolated node(s):** `AdminRateLimitResult`, `MemoryEntry`, `RateLimitOptions`, `RateLimitRecord`, `RateLimitResult` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 213 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createSupabaseServerClient()` connect `rate-limit.ts` to `AdminSidebar.tsx`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Why does `logger` connect `lead-service.ts` to `rate-limit.ts`, `admin-dashboard-service.ts`, `vendor-service.ts`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `requireAdminSession()` connect `AdminSidebar.tsx` to `rate-limit.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **What connects `AdminRateLimitResult`, `MemoryEntry`, `RateLimitOptions` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `rate-limit.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.054203180785459264 - nodes in this community are weakly interconnected._
- **Should `vendor-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08552188552188553 - nodes in this community are weakly interconnected._
- **Should `lead-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08843537414965986 - nodes in this community are weakly interconnected._