import type { MetadataRoute } from "next";

/**
 * Canonical, indexable public pages only (/estimate and /login are noindex;
 * /admin and /api are private).
 * shortcut: lastModified is hand-maintained; bump a page's date when its
 * visible content changes, or derive it from git at build time if this list grows.
 */
const PAGES: Array<{ path: string; lastModified: string; priority: number }> = [
  { path: "", lastModified: "2026-11-26", priority: 1.0 },
  { path: "/services", lastModified: "2026-11-26", priority: 0.9 },
  { path: "/packages", lastModified: "2026-11-26", priority: 0.9 },
  { path: "/diwali-consultation", lastModified: "2026-11-26", priority: 0.8 },
  { path: "/for-vendors", lastModified: "2026-08-18", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://eventsika.in";

  return PAGES.map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: page.lastModified,
    priority: page.priority,
  }));
}
