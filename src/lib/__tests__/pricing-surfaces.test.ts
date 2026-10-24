import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ServicesPage from "@/app/services/page";
import PackagesPage from "@/app/packages/page";
import Packages from "@/components/Packages";
import PackageCustomizer from "@/components/PackageCustomizer";
import PackageComparison from "@/components/PackageComparison";
import Hero from "@/components/Hero";
import { BUDGET_OPTIONS } from "@/lib/backend/constants/allowlists";
import {
  calculatePackageEstimate,
  CUSTOM_QUOTE_LABEL,
  DEFAULT_GUEST_COUNT,
  DEFAULT_PACKAGE_ID,
  formatCurrency,
  OPTIONAL_SERVICES_CONFIG,
  PACKAGES_CONFIG,
} from "@/lib/packages-config";

function render(component: ComponentType): string {
  return renderToStaticMarkup(createElement(component));
}

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function rupeeAmounts(html: string): string[] {
  return html.match(/₹[\d,]+/g) ?? [];
}

/** Every rupee figure a pricing surface may display in its default state. */
function approvedDisplayAmounts(): Set<string> {
  const defaultEstimate = calculatePackageEstimate(DEFAULT_GUEST_COUNT, DEFAULT_PACKAGE_ID);
  return new Set(
    [
      ...PACKAGES_CONFIG.map((pkg) => pkg.pricePerPerson),
      ...OPTIONAL_SERVICES_CONFIG.flatMap((service) => Object.values(service.ratesPerPerson)),
      defaultEstimate.packageSubtotal,
      defaultEstimate.perPersonTotal,
      defaultEstimate.total,
    ].map(formatCurrency),
  );
}

const LEGACY_FLAT_ADDONS = [
  "Live Chaat &amp; Mocktail Corner",
  "Live Acoustic / Sufi Duo",
  "Custom Welcome Hampers",
  "Guest Valet &amp; Concierge",
];

const MISLEADING_TERMS = [
  "Planning &amp; Coordination Fee",
  "Planning Fee",
  "planning fee",
  "Vendor estimates",
  "Ballpark",
  "inclusive of",
  "applicable taxes",
  "tax-inclusive",
  "tax-exclusive",
  "Starting at ₹",
  "Starting from ₹",
  "/ plate",
];

const surfaces: Array<[string, ComponentType]> = [
  ["/services page", ServicesPage],
  ["/packages page", PackagesPage],
  ["homepage packages section", Packages],
  ["package customizer", PackageCustomizer],
  ["package comparison", PackageComparison],
];

describe.each(surfaces)("%s pricing copy", (_name, component) => {
  const html = render(component);

  it("shows only approved public rupee amounts", () => {
    const allowed = approvedDisplayAmounts();
    const unexpected = rupeeAmounts(html).filter((amount) => !allowed.has(amount));
    expect(unexpected).toEqual([]);
  });

  it("contains no stale flat-priced add-ons or misleading pricing terms", () => {
    for (const term of [...LEGACY_FLAT_ADDONS, ...MISLEADING_TERMS]) {
      expect(html).not.toContain(term);
    }
  });
});

describe("Shared package customizer", () => {
  const html = render(PackageCustomizer);

  it("starts with every optional service unchecked and Premium selected", () => {
    expect(html.match(/<input type="checkbox"[^>]*>/g)).toHaveLength(8);
    expect(html).not.toMatch(/<input type="checkbox"[^>]*checked/);
    const radios = html.match(/<input type="radio"[^>]*>/g) ?? [];
    expect(radios.filter((radio) => radio.includes("checked"))).toEqual([
      expect.stringContaining('value="premium"'),
    ]);
  });

  it("lists all eight services at the selected tier's per-person rate", () => {
    for (const service of OPTIONAL_SERVICES_CONFIG) {
      expect(html).toContain(service.name.replace(/&/g, "&amp;"));
      expect(html).toContain(formatCurrency(service.ratesPerPerson.premium) + " / person");
    }
  });

  it("labels the default decor-only estimate accurately", () => {
    expect(html).toContain("Indicative Event Estimate");
    expect(html).toContain("Decor Package (Premium)");
    expect(html).toContain("Selected Services");
    expect(html).toContain("None selected");
    expect(html).toContain("₹50,000");
    expect(html).toContain("Includes: Decor only");
    expect(html).toContain("tax treatment will be confirmed in the final quote");
    expect(html).toContain(
      'href="/estimate?package=premium&amp;packageGuests=25&amp;packageAddons="',
    );
    expect(html).toContain("View My Indicative Estimate");
  });
});

describe("Homepage packages section", () => {
  const html = render(Packages);

  it("presents the three canonical tiers as decor-only packages", () => {
    for (const pkg of PACKAGES_CONFIG) {
      expect(html).toContain(`>${pkg.name}<`);
      expect(html).toContain(formatCurrency(pkg.pricePerPerson) + " / person");
    }
    expect(html.match(/Includes: Decor only/g)).toHaveLength(3);
    expect(html).toContain("Each package includes decor only");
  });
});

describe("Package comparison matrix", () => {
  const html = decodeEntities(render(PackageComparison));

  it("marks decor as included and every optional service as optional at the published rate", () => {
    expect(html).toContain("Included in Every Base Package");
    for (const service of OPTIONAL_SERVICES_CONFIG) {
      for (const pkg of PACKAGES_CONFIG) {
        expect(html).toContain(
          `Optional · ${formatCurrency(service.ratesPerPerson[pkg.id])} / person`,
        );
      }
    }
    expect(html).not.toMatch(/catering[^<]*Included/i);
  });
});

describe("/services page", () => {
  const html = decodeEntities(render(ServicesPage));

  function articleFor(title: string): string {
    const article = html
      .split("<article")
      .find((block) => block.includes(`>${title}</h2>`));
    if (!article) throw new Error(`Missing service article: ${title}`);
    return article.split("</article>")[0];
  }

  it.each([
    ["Rituals & Blessings", "₹12,000"],
    ["Entertainment & Performers", "₹15,000"],
    ["Invitations & Favours", "₹5,000"],
  ])("keeps %s unpriced until a rate is approved", (title, legacyPrice) => {
    const article = articleFor(title);
    expect(article).toContain(CUSTOM_QUOTE_LABEL);
    expect(article).not.toContain(legacyPrice);
  });

  it("derives priced service labels from the approved catalog", () => {
    expect(articleFor("Decor & Styling")).toContain("Decor packages from ₹1,500 / person");
    expect(articleFor("Catering & Cuisine")).toContain("Food & catering from ₹2,000 / person");
    expect(articleFor("Photography & Films")).toContain(
      "Photography from ₹500 / person · Videography from ₹1,000 / person",
    );
  });

  it("uses the shared package calculator instead of a separate estimator", () => {
    expect(html).toContain('id="customizer"');
    expect(html).not.toContain('id="estimator"');
    expect(existsSync(path.resolve("src/components/ServiceEstimator.tsx"))).toBe(false);
  });
});

describe("/packages page", () => {
  const html = decodeEntities(render(PackagesPage));

  it("shows custom-quote labels instead of starting prices for venue formats", () => {
    for (const id of [
      "balcony-terrace",
      "driveway-lawns",
      "living-rooms-dinner",
      "showrooms-offices",
      "grand-celebrations",
      "small-budget-wedding",
    ]) {
      const card = html.split(`id="${id}"`)[1]?.split("</li>")[0] ?? "";
      expect(card).toContain(CUSTOM_QUOTE_LABEL);
      expect(card).not.toContain("₹");
    }
  });

  it("publishes structured data generated only from approved catalog prices", () => {
    const jsonLdBlocks = [
      ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ].map((match) => JSON.parse(match[1]));
    const catalog = jsonLdBlocks.find((block) => block["@type"] === "OfferCatalog");
    const prices = JSON.stringify(catalog).match(/"price":\d+/g) ?? [];

    const approved = new Set(
      [
        ...PACKAGES_CONFIG.map((pkg) => pkg.pricePerPerson),
        ...OPTIONAL_SERVICES_CONFIG.flatMap((service) => Object.values(service.ratesPerPerson)),
      ].map((price) => `"price":${price}`),
    );

    expect(prices).toHaveLength(3 + 8 * 3);
    expect(prices.every((price) => approved.has(price))).toBe(true);
    expect(JSON.stringify(catalog)).not.toMatch(/Balcony|Driveway|Grand Celebrations|Showrooms/);
  });
});

describe("Hero enquiry form without a package quote", () => {
  const html = decodeEntities(render(Hero));

  it("keeps the ordinary enquiry form and existing budget bands", () => {
    expect(html).not.toContain("Decor Package Subtotal");
    for (const budget of BUDGET_OPTIONS) {
      expect(html).toContain(budget);
    }
  });
});
