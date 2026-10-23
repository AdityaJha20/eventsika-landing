import { describe, expect, it } from "vitest";
import {
  ADDONS_CONFIG,
  calculatePackageEstimate,
  DEFAULT_PACKAGE_ID,
  GUEST_PRESETS,
  MIN_GUEST_COUNT,
  formatCurrency,
  formatIndicativeVendorEstimate,
  formatPackageRate,
  PACKAGES_CONFIG,
} from "../packages-config";

describe("Eventsika package pricing configuration", () => {
  it("defines exactly the confirmed package tiers and rates", () => {
    expect(
      PACKAGES_CONFIG.map(({ id, name, pricePerPerson }) => ({
        id,
        name,
        pricePerPerson,
      })),
    ).toEqual([
      { id: "essential", name: "ESSENTIAL", pricePerPerson: 1500 },
      { id: "premium", name: "PREMIUM", pricePerPerson: 2000 },
      { id: "luxury", name: "LUXURY", pricePerPerson: 2500 },
    ]);
  });

  it("derives readable rates from the numeric source of truth", () => {
    expect(formatPackageRate(1500)).toBe("₹1,500 / person");
    expect(formatPackageRate(2000)).toBe("₹2,000 / person");
    expect(formatPackageRate(2500)).toBe("₹2,500 / person");
  });

  it("keeps the default package valid and guest presets at or above the minimum", () => {
    expect(PACKAGES_CONFIG.some((pkg) => pkg.id === DEFAULT_PACKAGE_ID)).toBe(true);
    expect(DEFAULT_PACKAGE_ID).toBe("premium");
    expect(MIN_GUEST_COUNT).toBe(10);
    expect(GUEST_PRESETS.length).toBeGreaterThan(0);
    expect(GUEST_PRESETS.every((count) => count >= MIN_GUEST_COUNT)).toBe(true);
  });

  it("uses unique add-on identifiers and positive whole-rupee estimate amounts", () => {
    const ids = ADDONS_CONFIG.map((addon) => addon.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      ADDONS_CONFIG.every(
        (addon) => Number.isInteger(addon.price) && addon.price > 0,
      ),
    ).toBe(true);
  });

  it.each([
    [10, 15000, 20000, 25000],
    [25, 37500, 50000, 62500],
    [50, 75000, 100000, 125000],
    [100, 150000, 200000, 250000],
  ])(
    "calculates planning fees correctly for %i guests",
    (guests, essential, premium, luxury) => {
      expect(calculatePackageEstimate(guests, "essential").planningFee).toBe(essential);
      expect(calculatePackageEstimate(guests, "premium").planningFee).toBe(premium);
      expect(calculatePackageEstimate(guests, "luxury").planningFee).toBe(luxury);
    },
  );

  it("clamps the estimate to the minimum guest count", () => {
    expect(calculatePackageEstimate(3, "essential").guestCount).toBe(10);
    expect(calculatePackageEstimate(Number.NaN, "premium").guestCount).toBe(10);
  });

  it("adds selected vendor estimates separately from the planning fee", () => {
    const estimate = calculatePackageEstimate(25, "premium", [
      "photography-films",
      "live-music",
    ]);

    expect(estimate.planningFee).toBe(50000);
    expect(estimate.selectedVendorEstimate).toBe(38000);
    expect(estimate.combinedEstimate).toBe(88000);
  });

  it("does not double-count duplicate or unknown vendor add-on IDs", () => {
    const estimate = calculatePackageEstimate(10, "essential", [
      "live-music",
      "live-music",
      "unknown-addon",
    ]);

    expect(estimate.selectedVendorEstimate).toBe(20000);
    expect(estimate.combinedEstimate).toBe(35000);
  });

  it("formats currency and vendor estimates clearly", () => {
    expect(formatCurrency(150000)).toBe("₹1,50,000");
    expect(formatIndicativeVendorEstimate(15000)).toBe("Indicative from ₹15,000");
  });
});
