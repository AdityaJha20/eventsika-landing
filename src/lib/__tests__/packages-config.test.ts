import { describe, expect, it } from "vitest";
import * as packagesConfig from "../packages-config";
import {
  calculatePackageEstimate,
  clampGuestCount,
  DEFAULT_PACKAGE_ID,
  formatCurrency,
  formatPackageRate,
  formatPerPersonRate,
  getLowestServiceRate,
  GUEST_PRESETS,
  isOptionalServiceId,
  isPackageTierId,
  MAX_GUEST_COUNT,
  MIN_GUEST_COUNT,
  OPTIONAL_SERVICE_IDS,
  OPTIONAL_SERVICES_CONFIG,
  PACKAGES_CONFIG,
  type OptionalServiceId,
  type PackageTierId,
} from "../packages-config";

const APPROVED_SERVICE_RATES: Array<
  [OptionalServiceId, string, number, number, number]
> = [
  ["food", "Food & catering", 2000, 2600, 3380],
  ["floral", "Floral styling", 240, 312, 405],
  ["bartending", "Bartending", 120, 156, 202],
  ["housekeeping", "Housekeeping", 120, 156, 202],
  ["valet", "Valet & concierge", 120, 156, 202],
  ["light-sound", "Light & sound", 200, 260, 338],
  ["photography", "Photography", 500, 750, 1000],
  ["videography", "Videography", 1000, 1500, 2000],
];

const TIERS: PackageTierId[] = ["essential", "premium", "luxury"];
const DECOR_RATES: Record<PackageTierId, number> = {
  essential: 1500,
  premium: 2000,
  luxury: 2500,
};

describe("Eventsika package pricing catalog", () => {
  it("defines exactly the approved decor package tiers, names and rates", () => {
    expect(
      PACKAGES_CONFIG.map(({ id, name, pricePerPerson }) => ({ id, name, pricePerPerson })),
    ).toEqual([
      { id: "essential", name: "Essential", pricePerPerson: 1500 },
      { id: "premium", name: "Premium", pricePerPerson: 2000 },
      { id: "luxury", name: "Luxury", pricePerPerson: 2500 },
    ]);
  });

  it("defines exactly the eight approved optional services in a stable order", () => {
    expect(OPTIONAL_SERVICE_IDS).toEqual([
      "food",
      "floral",
      "bartending",
      "housekeeping",
      "valet",
      "light-sound",
      "photography",
      "videography",
    ]);
    expect(OPTIONAL_SERVICES_CONFIG.map((service) => service.id)).toEqual([
      ...OPTIONAL_SERVICE_IDS,
    ]);
  });

  it.each(APPROVED_SERVICE_RATES)(
    "publishes the exact approved per-person rates for %s",
    (id, name, essential, premium, luxury) => {
      const service = OPTIONAL_SERVICES_CONFIG.find((item) => item.id === id);
      expect(service?.name).toBe(name);
      expect(service?.ratesPerPerson).toEqual({ essential, premium, luxury });
    },
  );

  it("keeps every published amount a positive whole rupee", () => {
    const amounts = [
      ...PACKAGES_CONFIG.map((pkg) => pkg.pricePerPerson),
      ...OPTIONAL_SERVICES_CONFIG.flatMap((service) => Object.values(service.ratesPerPerson)),
    ];
    expect(amounts).toHaveLength(3 + 8 * 3);
    expect(amounts.every((amount) => Number.isInteger(amount) && amount > 0)).toBe(true);
  });

  it("exposes only public pricing fields and no internal commercial data", () => {
    const serialized = JSON.stringify({
      packages: PACKAGES_CONFIG,
      services: OPTIONAL_SERVICES_CONFIG,
    }).toLowerCase();
    for (const forbidden of ["cost", "margin", "markup", "profit"]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(Object.keys(packagesConfig)).not.toContain("ADDONS_CONFIG");
  });

  it("keeps the default package valid and guest presets within the domain limits", () => {
    expect(DEFAULT_PACKAGE_ID).toBe("premium");
    expect(isPackageTierId(DEFAULT_PACKAGE_ID)).toBe(true);
    expect(MIN_GUEST_COUNT).toBe(10);
    expect(MAX_GUEST_COUNT).toBe(10000);
    expect(GUEST_PRESETS.length).toBeGreaterThan(0);
    expect(
      GUEST_PRESETS.every((count) => count >= MIN_GUEST_COUNT && count <= MAX_GUEST_COUNT),
    ).toBe(true);
  });

  it("recognises only current tier and service identifiers", () => {
    expect(isPackageTierId("luxury")).toBe(true);
    expect(isPackageTierId("signature")).toBe(false);
    expect(isPackageTierId(undefined)).toBe(false);
    expect(isOptionalServiceId("light-sound")).toBe(true);
    expect(isOptionalServiceId("photography-films")).toBe(false);
    expect(isOptionalServiceId("valet-concierge")).toBe(false);
    expect(isOptionalServiceId(42)).toBe(false);
  });

  it("reports the lowest published rate for each service", () => {
    expect(getLowestServiceRate("food")).toBe(2000);
    expect(getLowestServiceRate("floral")).toBe(240);
    expect(getLowestServiceRate("photography")).toBe(500);
    expect(getLowestServiceRate("videography")).toBe(1000);
  });
});

describe("Indicative estimate calculation", () => {
  it.each([
    ["essential", 1500, 37500],
    ["premium", 2000, 50000],
    ["luxury", 2500, 62500],
  ] as const)(
    "charges decor only for %s with no optional services (25 guests)",
    (tierId, perPerson, total) => {
      const estimate = calculatePackageEstimate(25, tierId, []);
      expect(estimate.services).toEqual([]);
      expect(estimate.servicesSubtotal).toBe(0);
      expect(estimate.perPersonTotal).toBe(perPerson);
      expect(estimate.packageSubtotal).toBe(total);
      expect(estimate.total).toBe(total);
    },
  );

  // Hand-computed from the approved rate table; literal totals guard the formula.
  it.each([
    // tier, selection, guests, per person, total
    ["essential", "none", 10, 1500, 15000],
    ["essential", "none", 25, 1500, 37500],
    ["essential", "none", 100, 1500, 150000],
    ["premium", "none", 10, 2000, 20000],
    ["premium", "none", 25, 2000, 50000],
    ["premium", "none", 100, 2000, 200000],
    ["luxury", "none", 10, 2500, 25000],
    ["luxury", "none", 25, 2500, 62500],
    ["luxury", "none", 100, 2500, 250000],
    ["essential", "all", 10, 5800, 58000],
    ["essential", "all", 25, 5800, 145000],
    ["essential", "all", 100, 5800, 580000],
    ["premium", "all", 10, 7890, 78900],
    ["premium", "all", 25, 7890, 197250],
    ["premium", "all", 100, 7890, 789000],
    ["luxury", "all", 10, 10229, 102290],
    ["luxury", "all", 25, 10229, 255725],
    ["luxury", "all", 100, 10229, 1022900],
    // food + photography
    ["essential", "partial", 10, 4000, 40000],
    ["premium", "partial", 25, 5350, 133750],
    ["luxury", "partial", 100, 6880, 688000],
    // floral + bartending + housekeeping + valet + light & sound
    ["essential", "small", 100, 2300, 230000],
    ["premium", "small", 10, 3040, 30400],
    ["luxury", "small", 25, 3849, 96225],
  ] as const)(
    "matches the acceptance total for %s with %s services at %i guests",
    (tierId, selection, guests, perPerson, total) => {
      const serviceIds = {
        none: [],
        all: OPTIONAL_SERVICE_IDS,
        partial: ["food", "photography"],
        small: ["floral", "bartending", "housekeeping", "valet", "light-sound"],
      }[selection];
      const estimate = calculatePackageEstimate(guests, tierId, serviceIds);

      expect(estimate.perPersonTotal).toBe(perPerson);
      expect(estimate.total).toBe(total);
      expect(estimate.packageSubtotal).toBe(guests * DECOR_RATES[tierId]);
      expect(estimate.packageSubtotal + estimate.servicesSubtotal).toBe(total);
    },
  );

  it("defaults to no optional services when none are passed", () => {
    expect(calculatePackageEstimate(25, "premium").total).toBe(50000);
  });

  it.each([
    ["essential", 5800, 145000, "₹1,45,000"],
    ["premium", 7890, 197250, "₹1,97,250"],
    ["luxury", 10229, 255725, "₹2,55,725"],
  ] as const)(
    "charges all eight optional services per guest for %s (25 guests)",
    (tierId, perPerson, total, formatted) => {
      const estimate = calculatePackageEstimate(25, tierId, OPTIONAL_SERVICE_IDS);
      expect(estimate.services).toHaveLength(8);
      expect(estimate.perPersonTotal).toBe(perPerson);
      expect(estimate.total).toBe(total);
      expect(estimate.packageSubtotal + estimate.servicesSubtotal).toBe(total);
      expect(formatCurrency(estimate.total)).toBe(formatted);
    },
  );

  describe.each(TIERS)("each service selected individually on %s", (tierId) => {
    it.each(APPROVED_SERVICE_RATES)(
      "adds %s at its per-person rate",
      (serviceId, name, essential, premium, luxury) => {
        const rate = { essential, premium, luxury }[tierId];
        const estimate = calculatePackageEstimate(25, tierId, [serviceId]);

        expect(estimate.services).toEqual([
          { id: serviceId, name, ratePerPerson: rate, subtotal: 25 * rate },
        ]);
        expect(estimate.decorRatePerPerson).toBe(DECOR_RATES[tierId]);
        expect(estimate.servicesRatePerPerson).toBe(rate);
        expect(estimate.servicesSubtotal).toBe(25 * rate);
        expect(estimate.perPersonTotal).toBe(DECOR_RATES[tierId] + rate);
        expect(estimate.total).toBe(25 * (DECOR_RATES[tierId] + rate));
      },
    );
  });

  it("calculates a partial selection from the formula", () => {
    const estimate = calculatePackageEstimate(40, "premium", ["food", "photography"]);
    expect(estimate.packageSubtotal).toBe(40 * 2000);
    expect(estimate.services.map(({ id, subtotal }) => ({ id, subtotal }))).toEqual([
      { id: "food", subtotal: 40 * 2600 },
      { id: "photography", subtotal: 40 * 750 },
    ]);
    expect(estimate.servicesSubtotal).toBe(40 * (2600 + 750));
    expect(estimate.perPersonTotal).toBe(2000 + 2600 + 750);
    expect(estimate.total).toBe(40 * 5350);
  });

  it.each([10, 25, 50, 100, 250, 10000])(
    "scales every line item linearly at %i guests",
    (guests) => {
      const estimate = calculatePackageEstimate(guests, "luxury", ["floral", "valet"]);
      expect(estimate.guestCount).toBe(guests);
      expect(estimate.packageSubtotal).toBe(guests * 2500);
      expect(estimate.services.map((service) => service.subtotal)).toEqual([
        guests * 405,
        guests * 202,
      ]);
      expect(estimate.total).toBe(guests * (2500 + 405 + 202));
    },
  );

  it("re-prices the same selected services when the tier changes", () => {
    const selection = ["food", "videography"] as const;
    const essential = calculatePackageEstimate(30, "essential", selection);
    const luxury = calculatePackageEstimate(30, "luxury", selection);

    expect(essential.services.map((service) => service.id)).toEqual(["food", "videography"]);
    expect(luxury.services.map((service) => service.id)).toEqual(["food", "videography"]);
    expect(essential.services.map((service) => service.ratePerPerson)).toEqual([2000, 1000]);
    expect(luxury.services.map((service) => service.ratePerPerson)).toEqual([3380, 2000]);
    expect(essential.total).toBe(30 * (1500 + 2000 + 1000));
    expect(luxury.total).toBe(30 * (2500 + 3380 + 2000));
  });

  it("recalculates when a service is checked or unchecked", () => {
    const before = calculatePackageEstimate(25, "essential", ["food"]);
    const checked = calculatePackageEstimate(25, "essential", ["food", "bartending"]);
    const unchecked = calculatePackageEstimate(25, "essential", ["bartending"]);

    expect(checked.total - before.total).toBe(25 * 120);
    expect(unchecked.total).toBe(25 * (1500 + 120));
  });

  it("never charges a duplicate service twice and ignores unknown identifiers", () => {
    const estimate = calculatePackageEstimate(10, "essential", [
      "photography",
      "photography",
      "live-music",
      "photography-films",
    ]);
    expect(estimate.services.map((service) => service.id)).toEqual(["photography"]);
    expect(estimate.servicesSubtotal).toBe(10 * 500);
    expect(estimate.total).toBe(10 * 2000);
  });

  it("returns service lines in catalog order regardless of selection order", () => {
    const a = calculatePackageEstimate(25, "premium", ["videography", "food", "valet"]);
    const b = calculatePackageEstimate(25, "premium", ["valet", "videography", "food"]);
    expect(a).toEqual(b);
    expect(a.services.map((service) => service.id)).toEqual(["food", "valet", "videography"]);
  });

  it("clamps guest counts to the supported domain limits", () => {
    expect(clampGuestCount(3)).toBe(MIN_GUEST_COUNT);
    expect(clampGuestCount(Number.NaN)).toBe(MIN_GUEST_COUNT);
    expect(clampGuestCount(10001)).toBe(MAX_GUEST_COUNT);
    expect(calculatePackageEstimate(3, "essential").guestCount).toBe(10);
    expect(calculatePackageEstimate(10001, "luxury").total).toBe(10000 * 2500);
  });

  it("rejects unknown package tiers", () => {
    expect(() =>
      calculatePackageEstimate(25, "signature" as PackageTierId),
    ).toThrow("Unknown Eventsika package tier");
  });
});

describe("Price formatting", () => {
  it("formats whole rupees with Indian digit grouping", () => {
    expect(formatCurrency(37500)).toBe("₹37,500");
    expect(formatCurrency(150000)).toBe("₹1,50,000");
    expect(formatCurrency(25000000)).toBe("₹2,50,00,000");
  });

  it("formats per-person rates", () => {
    expect(formatPerPersonRate(405)).toBe("₹405 / person");
    expect(formatPerPersonRate(3380)).toBe("₹3,380 / person");
    expect(formatPackageRate(1500)).toBe("₹1,500 / person");
    expect(formatPackageRate(2000)).toBe("₹2,000 / person");
    expect(formatPackageRate(2500)).toBe("₹2,500 / person");
  });
});
