# Graph Report - landing  (2026-09-08)

## Corpus Check
- 123 files · ~147,870 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 580 nodes · 1103 edges · 34 communities (21 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5dc3533d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- rate-limit.ts
- vendor-service.ts
- devDependencies
- lead-schema.ts
- analytics-repository.interface.ts
- mailer.ts
- compilerOptions
- packages/page.tsx
- VendorsWorkspace.tsx
- getSupabaseAdminClient
- app/page.tsx
- AdminSidebar.tsx
- services/page.tsx
- for-vendors/page.tsx
- diwali-consultation/page.tsx
- Hero.tsx
- DiwaliLights.tsx
- env.ts
- middleware
- app/layout.tsx
- deduplicator.ts
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
1. `ValidatedLeadInput` - 21 edges
2. `ValidatedVendorInput` - 17 edges
3. `compilerOptions` - 16 edges
4. `SavedLeadRecord` - 15 edges
5. `ILeadRepository` - 15 edges
6. `getSupabaseAdminClient()` - 15 edges
7. `IVendorRepository` - 14 edges
8. `logger` - 13 edges
9. `IDeliveryNotifier` - 12 edges
10. `getOrCreateRequestId()` - 11 edges

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

## Communities (34 total, 10 thin omitted)

### Community 0 - "rate-limit.ts"
Cohesion: 0.05
Nodes (50): Tiered Rate Limiting Architecture, Fail-Closed Security Policy, Reverse-Proxy & Ingress Trust Assumptions, DELETE(), GET(), POST(), PUT(), DELETE() (+42 more)

### Community 1 - "vendor-service.ts"
Cohesion: 0.09
Nodes (25): VendorCategoryOption, VendorExperienceTier, LogContext, logger, LogLevel, maskPhone(), defaultVendorRepository, InMemoryVendorRepository (+17 more)

### Community 2 - "devDependencies"
Cohesion: 0.05
Nodes (42): Next.js 16 Breaking Changes Directives, babel-plugin-react-compiler, Claude Agent Steering Pointer, eslint, eslint-config-next, next, dependencies, next (+34 more)

### Community 3 - "lead-schema.ts"
Cohesion: 0.07
Nodes (43): Celebration Intake Pipeline, Repository Pattern & Storage Abstraction, cleanIndianPhone(), formatDisplayDate(), formatDisplayDateTime(), isRecentSubmission(), LeadsWorkspace(), LeadsWorkspaceProps (+35 more)

### Community 4 - "analytics-repository.interface.ts"
Cohesion: 0.09
Nodes (27): AnalyticsWorkspace(), AnalyticsWorkspaceProps, TABS, CITY_GEO_COORDINATES, IndiaDemandMap(), IndiaDemandMapProps, INDIA_MAP_STATES, INDIA_MAP_VIEWBOX (+19 more)

### Community 5 - "mailer.ts"
Cohesion: 0.39
Nodes (8): escapeHtml(), generateHtmlEmail(), generatePlainText(), LeadEmailPayload, maskEmailForLogs(), maskPhoneForLogs(), sanitizeDataForSafeLog(), sendNotificationEmail()

### Community 6 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 7 - "packages/page.tsx"
Cohesion: 0.12
Nodes (21): breadcrumbJsonLd, metadata, PACKAGE_TIERS, packagesJsonLd, PackageTier, COMPARISON_DATA, ComparisonCategory, ComparisonItem (+13 more)

### Community 8 - "VendorsWorkspace.tsx"
Cohesion: 0.16
Nodes (18): metadata, RFC-4180, buildVendorCsvContent(), cleanIndianPhone(), formatDisplayDate(), formatDisplayDateTime(), sanitizeCsvCell(), sanitizeEmailForMailto() (+10 more)

### Community 9 - "getSupabaseAdminClient"
Cohesion: 0.13
Nodes (13): AdminDashboardPage(), getInitials(), metadata, DashboardData, DashboardMetrics, IDashboardRepository, RecentActivityItem, RecentActivityType (+5 more)

### Community 10 - "app/page.tsx"
Cohesion: 0.19
Nodes (8): EVENT_TYPES, EventTypes(), BENEFITS, ForVendors(), HowItWorks(), STEPS, Packages(), Services

### Community 11 - "AdminSidebar.tsx"
Cohesion: 0.12
Nodes (15): AdminHeader(), AdminHeaderProps, AdminShell(), AdminShellProps, AdminSidebar(), AdminSidebarProps, NavItem, AdminLayout() (+7 more)

### Community 12 - "services/page.tsx"
Cohesion: 0.18
Nodes (9): breadcrumbJsonLd, metadata, SERVICES_DATA, ESTIMATOR_OPTIONS, EstimatorOption, ServiceEstimator(), FAQ_DATA, FAQItem (+1 more)

### Community 13 - "for-vendors/page.tsx"
Cohesion: 0.15
Nodes (11): breadcrumbJsonLd, metadata, PARTNER_CATEGORIES, VENDOR_BENEFITS, NAV_LINKS, Navbar(), FormData, FormErrors (+3 more)

### Community 14 - "diwali-consultation/page.tsx"
Cohesion: 0.15
Nodes (9): BENEFITS_DATA, CHECKLIST_ITEMS, INCLUSIONS_DATA, metadata, STEPS_DATA, TESTIMONIALS_DATA, EXPLORE_LINKS, Footer() (+1 more)

### Community 15 - "Hero.tsx"
Cohesion: 0.25
Nodes (8): BUDGET_OPTIONS, CITY_OPTIONS, EVENT_TYPE_OPTIONS, GUEST_COUNT_OPTIONS, Hero(), isValidPhoneNumber(), SERVICE_OPTIONS, VENUE_TYPE_OPTIONS

### Community 16 - "DiwaliLights.tsx"
Cohesion: 0.16
Nodes (10): DiwaliCtaDiya(), DiwaliLights(), DIYA_LIGHTS, DiyaLight, GOLDEN_DOTS, GoldenDot, ACTIVE_SEASONAL_OCCASION, SeasonalDecoration() (+2 more)

### Community 17 - "env.ts"
Cohesion: 0.46
Nodes (6): assertProductionEnv(), EnvValidationResult, getServerConfig(), isNonEmptyString(), ServerConfig, validateServerEnv()

### Community 18 - "middleware"
Cohesion: 0.33
Nodes (5): Concierge Operations Suite, Security Audit Protocol, mockGetUser, config, middleware()

### Community 19 - "app/layout.tsx"
Cohesion: 0.33
Nodes (4): inter, jsonLd, metadata, playfair

### Community 20 - "deduplicator.ts"
Cohesion: 0.25
Nodes (4): deduplicator, generateLeadDeduplicationKey(), generateVendorDeduplicationKey(), RequestDeduplicator

## Knowledge Gaps
- **178 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+173 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 226 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createSupabaseServerClient()` connect `rate-limit.ts` to `AdminSidebar.tsx`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `logger` connect `vendor-service.ts` to `rate-limit.ts`, `getSupabaseAdminClient`, `lead-schema.ts`, `analytics-repository.interface.ts`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Why does `requireAdminSession()` connect `AdminSidebar.tsx` to `rate-limit.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _178 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `rate-limit.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.050837496326770495 - nodes in this community are weakly interconnected._
- **Should `vendor-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09333333333333334 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._