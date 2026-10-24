import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EstimatePage, { metadata } from "../page";
import EstimateDocument, {
  ESTIMATE_PAGE_DISCLAIMER,
  formatEstimateDate,
} from "../EstimateDocument";
import PrintEstimateButton from "../PrintEstimateButton";
import { PackageQuoteSummaryItems } from "@/components/Hero";
import {
  buildEstimateHref,
  buildPackageQuoteHref,
  parsePackageQuoteParams,
  parsePackageQuoteSearch,
  type PackageQuoteSelection,
} from "@/lib/package-quote";
import {
  calculatePackageEstimate,
  describeEstimateLine,
  estimateLineItems,
  formatCurrency,
  type OptionalServiceId,
  type PackageTierId,
} from "@/lib/packages-config";

// Approved public rates, restated independently of the catalog.
const DECOR: Record<PackageTierId, number> = { essential: 1500, premium: 2000, luxury: 2500 };
const SERVICES: Record<OptionalServiceId, [string, number, number, number]> = {
  food: ["Food & catering", 2000, 2600, 3380],
  floral: ["Floral styling", 240, 312, 405],
  bartending: ["Bartending", 120, 156, 202],
  housekeeping: ["Housekeeping", 120, 156, 202],
  valet: ["Valet & concierge", 120, 156, 202],
  "light-sound": ["Light & sound", 200, 260, 338],
  photography: ["Photography", 500, 750, 1000],
  videography: ["Videography", 1000, 1500, 2000],
};
const TIER_INDEX: Record<PackageTierId, 1 | 2 | 3> = { essential: 1, premium: 2, luxury: 3 };
const TIER_NAME: Record<PackageTierId, string> = {
  essential: "Essential",
  premium: "Premium",
  luxury: "Luxury",
};
const ALL_SERVICES = Object.keys(SERVICES) as OptionalServiceId[];

const CREATED_AT = new Date("2026-10-24T06:30:00.000Z");

function decode(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function renderDocument(selection: PackageQuoteSelection | null): string {
  return decode(
    renderToStaticMarkup(createElement(EstimateDocument, { selection, createdAt: CREATED_AT })),
  );
}

function rowFor(html: string, lineId: string): string {
  const row = html.split(`data-line-id="${lineId}"`)[1]?.split("</tr>")[0];
  if (row === undefined) throw new Error(`Missing estimate row: ${lineId}`);
  return row;
}

function cells(row: string): string[] {
  return [...row.matchAll(/<(?:th|td)[^>]*>(.*?)<\/(?:th|td)>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, "|").split("|").filter(Boolean)[0],
  );
}

function totalFor(html: string, label: string): string {
  const match = html.match(new RegExp(`<dt>${label}</dt><dd>([^<]*)</dd>`));
  if (!match) throw new Error(`Missing total: ${label}`);
  return match[1];
}

const SELECTIONS: Array<[string, OptionalServiceId[]]> = [
  ["package only", []],
  ["partial", ["photography", "food"]],
  ["all services", ALL_SERVICES],
];

describe.each<PackageTierId>(["essential", "premium", "luxury"])("%s estimate page", (tierId) => {
  describe.each(SELECTIONS)("%s", (_label, serviceIds) => {
    it.each([10, 25, 100])("itemises every charge correctly at %i guests", (guests) => {
      const html = renderDocument({ tierId, guestCount: guests, serviceIds });
      const servicePerPerson = serviceIds.reduce(
        (sum, id) => sum + SERVICES[id][TIER_INDEX[tierId]],
        0,
      );
      const perPerson = DECOR[tierId] + servicePerPerson;

      expect(cells(rowFor(html, "decor"))).toEqual([
        `${TIER_NAME[tierId]} Decor Package`,
        `${formatCurrency(DECOR[tierId])} / person`,
        String(guests),
        formatCurrency(guests * DECOR[tierId]),
      ]);

      const expectedOrder = ALL_SERVICES.filter((id) => serviceIds.includes(id));
      expect([...html.matchAll(/data-line-id="([^"]+)"/g)].map((m) => m[1])).toEqual([
        "decor",
        ...expectedOrder,
      ]);
      for (const id of expectedOrder) {
        const [name] = SERVICES[id];
        const rate = SERVICES[id][TIER_INDEX[tierId]];
        expect(cells(rowFor(html, id))).toEqual([
          name,
          `${formatCurrency(rate)} / person`,
          String(guests),
          formatCurrency(guests * rate),
        ]);
      }

      expect(totalFor(html, "Decor package subtotal")).toBe(formatCurrency(guests * DECOR[tierId]));
      expect(totalFor(html, "Selected services subtotal")).toBe(
        serviceIds.length ? formatCurrency(guests * servicePerPerson) : "None selected",
      );
      expect(totalFor(html, "Total per person")).toBe(`${formatCurrency(perPerson)} / person`);
      expect(totalFor(html, "Indicative grand total")).toBe(formatCurrency(guests * perPerson));
    });
  });
});

describe("estimate acceptance totals at 25 guests", () => {
  it.each([
    ["essential", [], "₹37,500"],
    ["premium", [], "₹50,000"],
    ["luxury", [], "₹62,500"],
    ["essential", ALL_SERVICES, "₹1,45,000"],
    ["premium", ALL_SERVICES, "₹1,97,250"],
    ["luxury", ALL_SERVICES, "₹2,55,725"],
  ] as const)("%s with %j services totals %s", (tierId, serviceIds, total) => {
    const html = renderDocument({ tierId, guestCount: 25, serviceIds: [...serviceIds] });
    expect(totalFor(html, "Indicative grand total")).toBe(total);
  });
});

describe("estimate document content", () => {
  const selection: PackageQuoteSelection = {
    tierId: "premium",
    guestCount: 25,
    serviceIds: ["food", "valet"],
  };
  const html = renderDocument(selection);

  it("uses the real Eventsika logo and a clear heading", () => {
    expect(html).toMatch(/<img[^>]*alt="Eventsika"[^>]*eventsika-official-logo\.png/);
    expect(html.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]).toBe("Indicative Event Estimate");
  });

  it("shows the package, guest count, Indian-format date and decor-only wording", () => {
    expect(html).toContain("<dt>Package</dt><dd>Premium</dd>");
    expect(html).toContain("<dt>Guests</dt><dd>25</dd>");
    expect(html).toContain('dateTime="2026-10-24T06:30:00.000Z">24 October 2026</time>');
    expect(html).toContain("<dt>Package includes</dt><dd>Decor only</dd>");
    expect(html).toContain("Includes decor only");
    expect(html).toContain(ESTIMATE_PAGE_DISCLAIMER);
  });

  it("formats the estimate date in India Standard Time", () => {
    expect(formatEstimateDate(new Date("2026-10-24T20:00:00.000Z"))).toBe("25 October 2026");
    expect(formatEstimateDate(new Date("2026-01-05T00:00:00.000Z"))).toBe("5 January 2026");
  });

  it("links the contact CTA to the prefilled enquiry form without submitting anything", () => {
    const cta = html.match(/<a[^>]*href="([^"]*)"[^>]*>Contact Eventsika about this estimate<\/a>/);
    expect(cta?.[1]).toBe(
      "/?package=premium&packageGuests=25&packageAddons=food,valet#plan-event",
    );
    expect(html).not.toMatch(/<form|method="post"|action=/i);
  });

  it("is not labelled as an invoice, receipt, booking or payment request", () => {
    const withoutDisclaimer = html.replace(ESTIMATE_PAGE_DISCLAIMER, "");
    expect(withoutDisclaimer).not.toMatch(/invoice|receipt|booking confirmed|tax invoice|pay now|payment/i);
    expect(ESTIMATE_PAGE_DISCLAIMER).toContain("not an invoice or a request for payment");
  });
});

describe("package-only estimate", () => {
  const html = renderDocument({ tierId: "essential", guestCount: 10, serviceIds: [] });

  it("shows an accessible empty-services state without zero-value lines", () => {
    expect(html).toContain('<p class="_emptyServices_');
    expect(html).toMatch(/role="status">No optional services selected<\/p>/);
    expect([...html.matchAll(/data-line-id="/g)]).toHaveLength(1);
    expect(html).not.toContain("₹0");
  });
});

describe("estimate URL handoff", () => {
  const selections: PackageQuoteSelection[] = [
    { tierId: "essential", guestCount: 10, serviceIds: [] },
    { tierId: "premium", guestCount: 37, serviceIds: ["videography", "light-sound"] },
    { tierId: "luxury", guestCount: 10000, serviceIds: ALL_SERVICES },
  ];

  function searchParamsOf(href: string): Record<string, string> {
    return Object.fromEntries(new URL(href, "https://eventsika.in").searchParams);
  }

  it.each(selections)("round-trips %j through the estimate URL and the contact CTA", (selection) => {
    const estimateHref = buildEstimateHref(selection);
    expect(estimateHref.startsWith("/estimate?")).toBe(true);
    expect(parsePackageQuoteParams(searchParamsOf(estimateHref))).toEqual(selection);

    const html = renderDocument(selection);
    const ctaHref = html.match(/href="([^"]*)"[^>]*>Contact Eventsika about this estimate/)?.[1];
    expect(ctaHref).toBe(buildPackageQuoteHref(selection));
    expect(parsePackageQuoteSearch(new URL(ctaHref!, "https://eventsika.in").search)).toEqual(
      selection,
    );
  });

  it("renders the selection when the route receives search params", async () => {
    const element = (await EstimatePage({
      searchParams: Promise.resolve(searchParamsOf(buildEstimateHref(selections[1]))),
    })) as ReactElement;
    const html = decode(renderToStaticMarkup(element));
    expect(html).toContain("Indicative Event Estimate");
    expect(totalFor(html, "Indicative grand total")).toBe(
      formatCurrency(37 * (2000 + 1500 + 260)),
    );
  });

  it("keeps the estimate page out of search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("homepage enquiry form matches the estimate page", () => {
  it.each<[PackageTierId, number, OptionalServiceId[]]>([
    ["essential", 10, []],
    ["premium", 25, ["food", "photography"]],
    ["luxury", 100, ALL_SERVICES],
  ])("shows the same breakdown for %s, %i guests", (tierId, guestCount, serviceIds) => {
    const selection = { tierId, guestCount, serviceIds };
    const estimateHtml = renderDocument(selection);
    const ctaHref = estimateHtml.match(/href="([^"]*)"[^>]*>Contact Eventsika about this estimate/)![1];

    // The hero parses the CTA link exactly as it does on the homepage.
    const prefill = parsePackageQuoteSearch(new URL(ctaHref, "https://eventsika.in").search)!;
    const heroEstimate = calculatePackageEstimate(
      prefill.guestCount,
      prefill.tierId,
      prefill.serviceIds,
    );
    const heroHtml = decode(
      renderToStaticMarkup(createElement(PackageQuoteSummaryItems, { estimate: heroEstimate })),
    );

    for (const line of estimateLineItems(heroEstimate)) {
      expect(heroHtml).toContain(`${line.label} · ${describeEstimateLine(line)}`);
      expect(cells(rowFor(estimateHtml, line.id))[3]).toBe(formatCurrency(line.subtotal));
    }
    expect(heroHtml).toContain(totalFor(estimateHtml, "Decor package subtotal"));
    expect(heroHtml).toContain(totalFor(estimateHtml, "Total per person"));
    expect(heroHtml).toContain(totalFor(estimateHtml, "Indicative grand total"));
    if (serviceIds.length === 0) {
      expect(heroHtml).toContain("No optional services selected");
      expect(heroHtml).not.toContain("₹0");
    } else {
      expect(heroHtml).toContain(totalFor(estimateHtml, "Selected services subtotal"));
    }
  });
});

describe("invalid or missing estimate links", () => {
  it.each<[string, Record<string, string | string[] | undefined>]>([
    ["no parameters", {}],
    ["unknown tier", { package: "signature", packageGuests: "25", packageAddons: "" }],
    ["missing guests", { package: "premium", packageAddons: "food" }],
    ["guests below minimum", { package: "premium", packageGuests: "9", packageAddons: "" }],
    ["fractional guests", { package: "premium", packageGuests: "12.5", packageAddons: "" }],
    ["unknown service", { package: "premium", packageGuests: "25", packageAddons: "fireworks" }],
    ["legacy add-on", { package: "premium", packageGuests: "25", packageAddons: "live-chaat" }],
    ["duplicate service", { package: "premium", packageGuests: "25", packageAddons: "food,food" }],
    ["repeated parameter", { package: ["premium", "luxury"], packageGuests: "25" }],
  ])("shows a recovery state with no prices for %s", async (_label, params) => {
    expect(parsePackageQuoteParams(params)).toBeNull();

    const element = (await EstimatePage({ searchParams: Promise.resolve(params) })) as ReactElement;
    const html = decode(renderToStaticMarkup(element));
    const main = html.split('<main id="main-content"')[1].split("</main>")[0];

    expect(main).toContain("We couldn't load this estimate");
    expect(main).toMatch(/<h1[^>]*>We couldn't load this estimate<\/h1>/);
    expect(main).toMatch(/href="\/packages#customizer"[^>]*>Return to the estimate calculator</);
    expect(main).not.toContain("₹");
    expect(main).not.toContain("Indicative grand total");
  });
});

describe("print support", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("offers a named print button that opens the browser print dialog", () => {
    const print = vi.fn();
    vi.stubGlobal("window", { print });

    const html = renderToStaticMarkup(createElement(PrintEstimateButton));
    expect(html).toMatch(/<button type="button"[^>]*>Print \/ Save as PDF<\/button>/);

    const button = PrintEstimateButton() as ReactElement<{ onClick: () => void }>;
    button.props.onClick();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("ships a print stylesheet that hides navigation and controls but keeps the document", () => {
    const css = readFileSync(path.resolve("src/app/estimate/estimate.module.css"), "utf8");
    const printBlock = css.split("@media print")[1];
    expect(printBlock).toBeDefined();
    expect(printBlock).toMatch(/\.screenOnly,\s*\.actions\s*\{\s*display:\s*none !important;/);
    expect(printBlock).not.toMatch(/\.(document|itemsTable|totals|disclaimer|logo)\s*\{[^}]*display:\s*none/);
  });

  it("keeps controls inside the print-hidden actions group and navigation in screen-only wrappers", async () => {
    const html = renderDocument({ tierId: "premium", guestCount: 25, serviceIds: [] });
    const actions = html.split('class="_actions_')[1].split("</div>")[0];
    expect(actions).toContain("Contact Eventsika about this estimate");
    expect(actions).toContain("Print / Save as PDF");

    const page = decode(
      renderToStaticMarkup(
        (await EstimatePage({
          searchParams: Promise.resolve({ package: "premium", packageGuests: "25", packageAddons: "" }),
        })) as ReactElement,
      ),
    );
    // React hoists the logo's preload <link>; everything else before <main> is the nav.
    const beforeMain = page.split('<main id="main-content"')[0].replace(/^(<link[^>]*>)+/, "");
    expect(beforeMain).toMatch(/^<div class="_screenOnly_/);
    expect(page.split("</main>")[1]).toMatch(/^<div class="_screenOnly_/);
  });
});

describe("accessibility and mobile layout", () => {
  const html = renderDocument({ tierId: "luxury", guestCount: 25, serviceIds: ["floral"] });

  it("uses a single h1, labelled sections and a captioned table with row and column headers", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('aria-labelledby="estimate-heading"');
    expect(html).toContain("<caption");
    expect(html.match(/<th scope="col">/g)).toHaveLength(4);
    expect(html.match(/<th scope="row"/g)).toHaveLength(2);
  });

  it("labels every value cell for the stacked mobile layout", () => {
    const dataCells = html.match(/<td[^>]*>/g) ?? [];
    expect(dataCells.length).toBe(6);
    expect(dataCells.every((cell) => /data-label="(Rate per person|Guests|Subtotal)"/.test(cell))).toBe(
      true,
    );

    const css = readFileSync(path.resolve("src/app/estimate/estimate.module.css"), "utf8");
    const mobile = css.split("@media (max-width: 640px)")[1].split("@media print")[0];
    expect(mobile).toContain("content: attr(data-label)");
    expect(mobile).toMatch(/\.itemsTable tbody td \{[^}]*white-space: normal/);
    expect(mobile).toMatch(/\.actions \{[^}]*flex-direction: column/);
  });
});

describe("confidentiality and stale pricing", () => {
  it("shows only approved rates and amounts derived from them", () => {
    const selection: PackageQuoteSelection = {
      tierId: "luxury",
      guestCount: 40,
      serviceIds: ALL_SERVICES,
    };
    const html = renderDocument(selection);
    const estimate = calculatePackageEstimate(40, "luxury", ALL_SERVICES);
    const allowed = new Set(
      [
        ...estimateLineItems(estimate).flatMap((line) => [line.ratePerPerson, line.subtotal]),
        estimate.packageSubtotal,
        estimate.servicesSubtotal,
        estimate.perPersonTotal,
        estimate.total,
      ].map(formatCurrency),
    );
    const shown = html.match(/₹[\d,]+/g) ?? [];
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.filter((amount) => !allowed.has(amount))).toEqual([]);
    expect(html.toLowerCase()).not.toMatch(/\b(cost|costing|margin|markup|profit)\b/);
  });

  it("does not hardcode prices in the estimate page source", () => {
    for (const file of ["EstimateDocument.tsx", "page.tsx", "PrintEstimateButton.tsx"]) {
      const source = readFileSync(path.resolve("src/app/estimate", file), "utf8");
      expect(source).not.toMatch(/₹\s?\d/);
      expect(source).not.toMatch(/\b(1500|2000|2500|2600|3380|405|312|202|156|338)\b/);
    }
  });
});
