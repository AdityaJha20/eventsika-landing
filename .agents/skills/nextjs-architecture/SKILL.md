---
name: nextjs-architecture
description: >-
  Provide practical Next.js 16, React 19, and App Router architecture guidance for the Eventsika project.
  Use this skill when designing features, making Server vs Client component decisions, structuring routes,
  planning data fetching/caching, optimizing images, managing metadata/SEO, or planning production deployments.
---

# Next.js Architecture & Best Practices Guide

Provide authoritative, pragmatic, and production-oriented architectural guidance for the Eventsika Next.js 16 (React 19) codebase.

---

## Core Philosophy

> **The Eventsika Principle**: *"Keep working code stable. Improve only where there is a clear reason."*  
> Favor the simplest architecture that cleanly solves the problem while matching established project patterns.

---

## Architectural Decision Framework

### 1. Server Components vs. Client Components
- **Default to Server Components (RSC)**: Keep pages, layouts, and static presentation components as Server Components by default to reduce client JavaScript bundle size and improve Core Web Vitals.
- **Push `"use client"` to the Leaf Nodes**: Add `"use client"` only to interactive leaf components that require React hooks (`useState`, `useEffect`, `useRef`), event handlers (`onClick`, `onChange`), or browser-only APIs.
- **Avoid Theoretical Conversions**: Do not refactor stable, working Client Components to Server Components unless there is a clear, measurable performance or maintenance benefit.
- **Composition over `"use client"` Sprawl**: Pass Server Components as `children` or props to Client Component wrappers rather than marking parent containers as Client Components.

### 2. Route Handlers vs. Server Actions
- **Route Handlers (`src/app/api/.../route.ts`)**: Use for external webhooks, public REST endpoints (e.g., lead capture API, vendor applications), and requests consumed by external services or mobile clients.
- **Server Actions (`'use server'`)**: Use for direct form mutations and interactive submissions tightly coupled with specific UI components.
- **Validation**: Always validate payloads on the server (types, required fields, reasonable string bounds) regardless of client-side validation.

### 3. Data Fetching, Caching & Revalidation
- **Fetch in RSC**: Perform async data fetching directly inside Server Components whenever practical.
- **Caching Intent**: Explicitly consider whether fetched data is static, revalidated on a schedule (`next: { revalidate: 3600 }`), or dynamic (`cache: 'no-store'`).
- **Targeted Invalidation**: Use `revalidatePath` or `revalidateTag` for surgical cache busting following mutations rather than resetting global state.

### 4. Metadata, SEO & OpenGraph
- **Layout & Page Metadata**: Define static `metadata` objects in `src/app/layout.tsx` and route `page.tsx` files. Use `generateMetadata` for dynamic title/description generation.
- **File-Based Metadata**: Prefer built-in App Router file conventions (`icon.png`, `apple-icon.png`, `robots.ts`, `sitemap.ts`, `opengraph-image.png`) over manual HTML `<link>` injection.
- **Structured Data**: Keep JSON-LD schemas centralized and valid, ensuring serialized data matches schema.org specifications without unescaped user input.

### 5. Image & Asset Optimization
- **Pragmatic Image Choice**: Prefer Next.js `<Image />` when its optimization, responsive sizing, or layout-stability benefits apply. Do not recommend replacing an existing working image implementation merely because `next/image` exists; consider the actual use case and existing project patterns first.
- **Aspect Ratio & Layout Stability**:
  - When using `next/image`, provide explicit `width` and `height` attributes to avoid Cumulative Layout Shift (CLS).
  - When using CSS to override dimensions, include `width: "auto"` or `height: "auto"` alongside it to prevent aspect-ratio console warnings.
  - Use `fill` with appropriate `sizes` attributes for full-bleed hero banners and responsive cards.

### 6. Component & Styling Conventions
- **Component Placement**: Place reusable UI components in `src/components/` and page-level route segments in `src/app/`.
- **CSS Modules**: Colocate styles alongside components using `.module.css` (e.g., `Hero.tsx` with `Hero.module.css`).
- **Font Optimization**: Utilize `next/font/google` in `src/app/layout.tsx` with CSS variable definitions and `display: 'swap'`.

### 7. Environment Variables & Secrets
- **Server-Only Secrets**: Keep private API keys (email dispatchers, database credentials, webhook secrets) strictly server-side. Never prefix them with `NEXT_PUBLIC_`.
- **Template Synchronization**: Document every new environment variable in `.env.example` with clear usage instructions while keeping actual values in `.env.local`.

### 8. Production Builds & Deployment Considerations
- **Build Verification Context**: Recommend running `npm run build` when an architectural change could affect routing, rendering, Server/Client boundaries, environment variables, build behavior, or production deployment. (A full build is not required for minor architectural discussions or localized styling changes).
- **Static vs. Dynamic Audit**: When evaluating routes, review the build output summary (`○ Static` vs `ƒ Dynamic`) to ensure public landing pages remain prerendered as static HTML.
- **Consult Context7**: When encountering modern Next.js 16 APIs, Turbopack features, or React 19 deprecations, consult Context7 MCP (`/vercel/next.js`) for the latest documented patterns.

---

## Architectural Recommendation Format

When proposing an architectural change or reviewing design options, present findings using this structure:

```markdown
### Next.js Architectural Assessment

#### Current Pattern
- [Describe the current file structure, component boundary, or data flow]

#### Context & Impact
- **Why It Matters**: [Explain the performance, maintainability, or functional implication]
- **Affected Files**: [List routes, components, or configs impacted]

#### Recommended Approach
- [Specific architectural pattern aligned with Eventsika and Next.js 16 best practices]
- **Rationale**: [Why this fits Eventsika's existing conventions and minimizes disruption]

#### Documentation & Framework Validation
- [Relevant Next.js 16 / React 19 documentation reference or Context7 lookup result]

#### Next Steps
- Awaiting user review and authorization before proceeding with implementation.
```
