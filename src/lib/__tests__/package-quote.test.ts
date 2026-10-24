import { describe, expect, it } from "vitest";
import * as packageQuoteHandoff from "../package-quote";
import {
  buildPackageQuoteHref,
  guestCountRangeFor,
  parsePackageQuoteSearch,
  serviceOptionsForPackageQuote,
} from "../package-quote";
import {
  isLegacyAddonId,
  LEGACY_ADDON_LABELS,
  summarizePackageQuote,
  type PackageQuoteRecord,
} from "../package-quote-summary";
import { GUEST_COUNT_OPTIONS, SERVICE_OPTIONS } from "../backend/constants/allowlists";
import {
  calculatePackageEstimate,
  ESTIMATE_DISCLAIMER,
  OPTIONAL_SERVICE_IDS,
  isOptionalServiceId,
} from "../packages-config";

function searchOf(href: string): string {
  return new URL(href, "https://eventsika.in").search;
}

describe("Package quote URL handoff", () => {
  it("keeps legacy quote data out of the module that ships in public pages", () => {
    expect(Object.keys(packageQuoteHandoff).sort()).toEqual([
      "buildPackageQuoteHref",
      "guestCountRangeFor",
      "parsePackageQuoteSearch",
      "serviceOptionsForPackageQuote",
    ]);
  });

  it("builds the hero prefill link with tier, exact guests and service IDs", () => {
    expect(
      buildPackageQuoteHref({
        tierId: "premium",
        guestCount: 25,
        serviceIds: ["food", "light-sound"],
      }),
    ).toBe("/?package=premium&packageGuests=25&packageAddons=food,light-sound#plan-event");
  });

  it("round-trips every tier with all services through the URL", () => {
    for (const tierId of ["essential", "premium", "luxury"] as const) {
      const selection = { tierId, guestCount: 137, serviceIds: [...OPTIONAL_SERVICE_IDS] };
      expect(parsePackageQuoteSearch(searchOf(buildPackageQuoteHref(selection)))).toEqual(
        selection,
      );
    }
  });

  it("round-trips a package-only selection", () => {
    const selection = { tierId: "luxury" as const, guestCount: 10, serviceIds: [] };
    expect(parsePackageQuoteSearch(searchOf(buildPackageQuoteHref(selection)))).toEqual(
      selection,
    );
  });

  it("accepts URL-encoded separators", () => {
    expect(
      parsePackageQuoteSearch("?package=essential&packageGuests=50&packageAddons=food%2Cvalet"),
    ).toEqual({ tierId: "essential", guestCount: 50, serviceIds: ["food", "valet"] });
  });

  it.each([
    ["no parameters", ""],
    ["unknown tier", "?package=signature&packageGuests=25"],
    ["missing guests", "?package=premium"],
    ["guests below minimum", "?package=premium&packageGuests=9"],
    ["guests above maximum", "?package=premium&packageGuests=10001"],
    ["fractional guests", "?package=premium&packageGuests=25.5"],
    ["unknown service", "?package=premium&packageGuests=25&packageAddons=fireworks"],
    ["legacy add-on", "?package=premium&packageGuests=25&packageAddons=photography-films"],
    ["duplicate service", "?package=premium&packageGuests=25&packageAddons=food,food"],
  ])("falls back to an ordinary enquiry for %s", (_label, search) => {
    expect(parsePackageQuoteSearch(search)).toBeNull();
  });
});

describe("Lead form mapping", () => {
  it.each([
    [10, "2–10 guests"],
    [11, "10–30 guests"],
    [30, "10–30 guests"],
    [50, "30–50 guests"],
    [100, "50–100 guests"],
    [200, "100–200 guests"],
    [201, "200+ guests"],
    [10000, "200+ guests"],
  ])("maps %i exact guests to the %s range", (count, range) => {
    expect(guestCountRangeFor(count)).toBe(range);
    expect(GUEST_COUNT_OPTIONS).toContain(range);
  });

  it("always includes decor and maps every optional service to an allowed lead category", () => {
    expect(serviceOptionsForPackageQuote([])).toEqual(["Decor & Styling"]);

    const all = serviceOptionsForPackageQuote([...OPTIONAL_SERVICE_IDS]);
    expect(all[0]).toBe("Decor & Styling");
    expect(new Set(all).size).toBe(all.length);
    expect(all.every((option) => SERVICE_OPTIONS.includes(option))).toBe(true);
    expect(serviceOptionsForPackageQuote(["photography", "videography"])).toEqual([
      "Decor & Styling",
      "Photography & Films",
    ]);
  });
});

describe("Stored quote summaries", () => {
  const currentQuote = (): PackageQuoteRecord => {
    const estimate = calculatePackageEstimate(25, "premium", ["food", "photography"]);
    return {
      tierId: "premium",
      guestCount: 25,
      serviceIds: ["food", "photography"],
      packageSubtotalRupees: estimate.packageSubtotal,
      servicesSubtotalRupees: estimate.servicesSubtotal,
      totalEstimateRupees: estimate.total,
    };
  };

  it("shows per-service rates for quotes that match the published catalog", () => {
    const summary = summarizePackageQuote(currentQuote());

    expect(summary).toMatchObject({
      isLegacyQuote: false,
      tierName: "Premium",
      packageLabel: "Decor Package",
      decorRatePerPerson: 2000,
      guestCount: 25,
      packageSubtotal: 50000,
      servicesLabel: "Selected Optional Services",
      servicesSubtotal: 25 * (2600 + 750),
      perPersonTotal: 2000 + 2600 + 750,
      total: 25 * 5350,
      note: ESTIMATE_DISCLAIMER,
    });
    expect(summary.services).toEqual([
      { id: "food", name: "Food & catering", ratePerPerson: 2600, subtotal: 65000 },
      { id: "photography", name: "Photography", ratePerPerson: 750, subtotal: 18750 },
    ]);
  });

  it("shows recorded amounts without per-service rates when they no longer reconcile", () => {
    const summary = summarizePackageQuote({
      ...currentQuote(),
      servicesSubtotalRupees: 1,
      totalEstimateRupees: 50001,
    });

    expect(summary.isLegacyQuote).toBe(false);
    expect(summary.decorRatePerPerson).toBeNull();
    expect(summary.servicesSubtotal).toBe(1);
    expect(summary.total).toBe(50001);
    expect(summary.perPersonTotal).toBeNull();
    expect(summary.services.every((service) => service.ratePerPerson === null)).toBe(true);
    expect(summary.services.map((service) => service.name)).toEqual([
      "Food & catering",
      "Photography",
    ]);
    expect(summary.note).toContain("exactly as recorded");
  });

  it("renders historical flat add-on leads with their original amounts and legacy labels", () => {
    const legacyQuote: PackageQuoteRecord = {
      tierId: "premium",
      guestCount: 25,
      serviceIds: ["photography-films", "live-music"],
      packageSubtotalRupees: 50000,
      servicesSubtotalRupees: 38000,
      totalEstimateRupees: 88000,
    };

    const summary = summarizePackageQuote(legacyQuote);

    expect(summary).toMatchObject({
      isLegacyQuote: true,
      tierName: "Premium",
      packageLabel: "Planning & coordination fee (legacy quote)",
      decorRatePerPerson: null,
      packageSubtotal: 50000,
      servicesLabel: "Legacy flat vendor estimates",
      servicesSubtotal: 38000,
      perPersonTotal: null,
      total: 88000,
    });
    expect(summary.services.map((service) => service.name)).toEqual([
      "Photography & Films (legacy flat estimate)",
      "Live Acoustic / Sufi Duo (legacy flat estimate)",
    ]);
    expect(summary.note).toContain("previous planning-fee model");
  });

  it("labels unrecognised stored service IDs safely", () => {
    const summary = summarizePackageQuote({
      tierId: "essential",
      guestCount: 10,
      serviceIds: ["mystery-service"],
      packageSubtotalRupees: 15000,
      servicesSubtotalRupees: 0,
      totalEstimateRupees: 15000,
    });
    expect(summary.services).toEqual([
      {
        id: "mystery-service",
        name: "Unrecognised service (mystery-service)",
        ratePerPerson: null,
        subtotal: null,
      },
    ]);
    expect(summary.total).toBe(15000);
  });

  it("keeps legacy add-on IDs disjoint from current service IDs", () => {
    for (const legacyId of Object.keys(LEGACY_ADDON_LABELS)) {
      expect(isLegacyAddonId(legacyId)).toBe(true);
      expect(isOptionalServiceId(legacyId)).toBe(false);
    }
    for (const id of OPTIONAL_SERVICE_IDS) {
      expect(isLegacyAddonId(id)).toBe(false);
    }
    expect(isLegacyAddonId("toString")).toBe(false);
  });
});
