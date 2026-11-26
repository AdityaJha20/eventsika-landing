import { describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import ServicesPage from "@/app/services/page";
import PackagesPage from "@/app/packages/page";
import { metadata as homeMetadata } from "@/app/page";
import ConsultationPage from "@/app/diwali-consultation/page";
import { DEFAULT_CONSULTATION_PRICE_PAISE } from "@/lib/backend/types/payment-and-consultation";
import { buildPackagesOfferCatalogJsonLd } from "../packages-structured-data";
import { ORGANIZATION_ID, pageMetadata } from "../seo";

function jsonLdBlocks(component: ComponentType): unknown[] {
  const html = renderToStaticMarkup(createElement(component));
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1]),
  );
}

describe("page metadata", () => {
  it("gives each page its own canonical, og:url and og:title", () => {
    const meta = pageMetadata({ title: "Packages", description: "d", path: "/packages" });
    expect(meta.alternates?.canonical).toBe("/packages");
    expect(meta.openGraph).toMatchObject({
      url: "https://eventsika.in/packages",
      title: "Packages | Eventsika",
    });
  });
});

describe("homepage metadata", () => {
  it("uses the same brand title for the page and its social cards", () => {
    expect(homeMetadata.title).toEqual({ absolute: "Eventsika | Celebrate Seamlessly" });
    expect(homeMetadata.openGraph?.title).toBe("Eventsika | Celebrate Seamlessly");
    expect(homeMetadata.twitter?.title).toBe("Eventsika | Celebrate Seamlessly");
  });
});

describe("sitemap and robots", () => {
  it("lists every canonical public page and no private or noindex route", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([
      "https://eventsika.in",
      "https://eventsika.in/services",
      "https://eventsika.in/packages",
      "https://eventsika.in/diwali-consultation",
      "https://eventsika.in/for-vendors",
    ]);
    for (const entry of sitemap()) {
      expect(String(entry.lastModified)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("allows public pages to every crawler and blocks only the API", () => {
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/"] });
  });
});

describe("structured data", () => {
  it("references the single site-wide Organization instead of redefining it", () => {
    const serialized = JSON.stringify([
      buildPackagesOfferCatalogJsonLd(),
      ...jsonLdBlocks(ServicesPage),
      ...jsonLdBlocks(PackagesPage),
    ]);
    expect(serialized).not.toContain('"@type":"Organization"');
    expect(serialized).toContain(`{"@id":"${ORGANIZATION_ID}"}`);
  });

  it("prices only the services that show a published rate on /services", () => {
    const services = (jsonLdBlocks(ServicesPage).find(
      (block) => (block as { "@graph"?: unknown })["@graph"],
    ) as { "@graph": Array<{ name: string; offers?: unknown }> })["@graph"];
    expect(services.map((service) => service.name)).toHaveLength(6);
    expect(services.filter((service) => service.offers).map((service) => service.name)).toEqual([
      "Decor & Styling",
      "Catering & Cuisine",
      "Photography & Films",
    ]);
  });

  it("publishes the consultation price the checkout actually charges", () => {
    const blocks = jsonLdBlocks(ConsultationPage).flat() as Array<{ offers?: { price: number } }>;
    const service = blocks.find((block) => block.offers);
    expect(service?.offers?.price).toBe(DEFAULT_CONSULTATION_PRICE_PAISE / 100);
    expect(service?.offers?.price).toBe(2999);
  });
});
