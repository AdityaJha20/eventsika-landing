# Graph Report - landing  (2026-09-05)

## Corpus Check
- 103 files · ~118,433 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 478 nodes · 851 edges · 32 communities (18 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 8,500 input · 1,600 output

## Community Hubs (Navigation)
- Rate Limiting & Admin Auth
- Celebration Lead Intake
- Vendor Partner Pipeline
- Core Dependencies & Toolchain
- Homepage & Presentation Components
- TypeScript Configuration & Types
- Admin Dashboard & Operations
- Admin Shell & Header UI
- Diwali Celebration Consultation
- Seasonal Lighting & Festive UI
- Service Showcase & Estimator
- Vendor Partner Landing Page
- Package Tiers & Comparison
- Admin Navigation & Session Controls
- Mailer Notification Engine
- Environment Configuration & Invariants
- Edge Security & Admin RBAC
- Root Layout & Global Typography
- Request Deduplication Engine
- Structured Logging & Redaction
- Content Security & Headers
- Authentication & Login Form
- Code Quality & ESLint Rules
- Next.js Architectural Standards
- Platform Memory & Knowledge
- Graphify Knowledge Graph Rules
- Curated Vendor Network
- Minimal Change Protocol
- Pre-Commit Review Protocol

## God Nodes (most connected - your core abstractions)
1. `ValidatedLeadInput` - 21 edges
2. `ValidatedVendorInput` - 16 edges
3. `compilerOptions` - 16 edges
4. `IDeliveryNotifier` - 12 edges
5. `getOrCreateRequestId()` - 11 edges
6. `getClientIp()` - 11 edges
7. `UpstashRedisRateLimitStore` - 11 edges
8. `isAllowedOrigin()` - 10 edges
9. `logger` - 10 edges
10. `ILeadRepository` - 10 edges

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
- **Security & Ingress Perimeter** — src_middleware_middleware, src_lib_rate_limit_getclientip, readme_reverse_proxy_trust, agents_skills_security_audit_skill_security_audit [INFERRED 0.95]
- **Celebration Lead Intake Pipeline** — agents_project_brain_brain_intake_pipeline, src_lib_backend_services_lead_service_leadservice, src_lib_rate_limit_checkratelimit [INFERRED 0.95]

## Communities (32 total, 11 thin omitted)

### Community 0 - "Rate Limiting & Admin Auth"
Cohesion: 0.06
Nodes (45): Tiered Rate Limiting Architecture, Fail-Closed Security Policy, Reverse-Proxy & Ingress Trust Assumptions, DELETE(), GET(), POST(), PUT(), createMockRequest() (+37 more)

### Community 1 - "Celebration Lead Intake"
Cohesion: 0.09
Nodes (32): Celebration Intake Pipeline, Repository Pattern & Storage Abstraction, BUDGET_OPTIONS, BudgetOption, CITY_OPTIONS, CityOption, EVENT_TYPE_OPTIONS, EventTypeOption (+24 more)

### Community 2 - "Vendor Partner Pipeline"
Cohesion: 0.10
Nodes (24): VENDOR_CATEGORIES, VENDOR_EXPERIENCE_TIERS, VendorCategoryOption, VendorExperienceTier, deduplicator, generateLeadDeduplicationKey(), generateVendorDeduplicationKey(), maskPhone() (+16 more)

### Community 3 - "Core Dependencies & Toolchain"
Cohesion: 0.05
Nodes (42): Next.js 16 Breaking Changes Directives, babel-plugin-react-compiler, Claude Agent Steering Pointer, eslint, eslint-config-next, next, dependencies, next (+34 more)

### Community 4 - "Homepage & Presentation Components"
Cohesion: 0.08
Nodes (28): EVENT_TYPES, EventTypes(), BENEFITS, ForVendors(), BUDGET_OPTIONS, CITY_OPTIONS, EVENT_TYPE_OPTIONS, GUEST_COUNT_OPTIONS (+20 more)

### Community 5 - "TypeScript Configuration & Types"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 6 - "Admin Dashboard & Operations"
Cohesion: 0.13
Nodes (14): AdminDashboardPage(), getInitials(), metadata, logger, DashboardData, DashboardMetrics, IDashboardRepository, RecentActivityItem (+6 more)

### Community 7 - "Admin Shell & Header UI"
Cohesion: 0.13
Nodes (15): AdminHeader(), AdminHeaderProps, AdminShell(), AdminShellProps, AdminSidebar(), AdminLayout(), metadata, DELETE() (+7 more)

### Community 8 - "Diwali Celebration Consultation"
Cohesion: 0.15
Nodes (9): BENEFITS_DATA, CHECKLIST_ITEMS, INCLUSIONS_DATA, metadata, STEPS_DATA, TESTIMONIALS_DATA, EXPLORE_LINKS, Footer() (+1 more)

### Community 9 - "Seasonal Lighting & Festive UI"
Cohesion: 0.16
Nodes (10): DiwaliCtaDiya(), DiwaliLights(), DIYA_LIGHTS, DiyaLight, GOLDEN_DOTS, GoldenDot, ACTIVE_SEASONAL_OCCASION, SeasonalDecoration() (+2 more)

### Community 10 - "Service Showcase & Estimator"
Cohesion: 0.18
Nodes (9): breadcrumbJsonLd, metadata, SERVICES_DATA, ESTIMATOR_OPTIONS, EstimatorOption, ServiceEstimator(), FAQ_DATA, FAQItem (+1 more)

### Community 11 - "Vendor Partner Landing Page"
Cohesion: 0.18
Nodes (9): breadcrumbJsonLd, metadata, PARTNER_CATEGORIES, VENDOR_BENEFITS, FormData, FormErrors, INITIAL_FORM_DATA, SERVICE_CATEGORIES (+1 more)

### Community 12 - "Package Tiers & Comparison"
Cohesion: 0.18
Nodes (9): breadcrumbJsonLd, metadata, PACKAGE_TIERS, packagesJsonLd, PackageTier, COMPARISON_DATA, ComparisonCategory, ComparisonItem (+1 more)

### Community 13 - "Admin Navigation & Session Controls"
Cohesion: 0.24
Nodes (7): AdminSidebarProps, NavItem, LogoutButton(), LogoutButtonProps, EventsikaLogo(), NAV_LINKS, Navbar()

### Community 14 - "Mailer Notification Engine"
Cohesion: 0.39
Nodes (8): escapeHtml(), generateHtmlEmail(), generatePlainText(), LeadEmailPayload, maskEmailForLogs(), maskPhoneForLogs(), sanitizeDataForSafeLog(), sendNotificationEmail()

### Community 15 - "Environment Configuration & Invariants"
Cohesion: 0.46
Nodes (6): assertProductionEnv(), EnvValidationResult, getServerConfig(), isNonEmptyString(), ServerConfig, validateServerEnv()

### Community 16 - "Edge Security & Admin RBAC"
Cohesion: 0.33
Nodes (5): Concierge Operations Suite, Security Audit Protocol, mockGetUser, config, middleware()

### Community 17 - "Root Layout & Global Typography"
Cohesion: 0.33
Nodes (4): inter, jsonLd, metadata, playfair

## Knowledge Gaps
- **160 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+155 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 198 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createSupabaseServerClient()` connect `Admin Shell & Header UI` to `Rate Limiting & Admin Auth`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `logger` connect `Admin Dashboard & Operations` to `Rate Limiting & Admin Auth`, `Celebration Lead Intake`, `Vendor Partner Pipeline`, `Admin Shell & Header UI`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _160 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Rate Limiting & Admin Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.055534987041836355 - nodes in this community are weakly interconnected._
- **Should `Celebration Lead Intake` be split into smaller, more focused modules?**
  _Cohesion score 0.0936026936026936 - nodes in this community are weakly interconnected._
- **Should `Vendor Partner Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.09513742071881606 - nodes in this community are weakly interconnected._
- **Should `Core Dependencies & Toolchain` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._