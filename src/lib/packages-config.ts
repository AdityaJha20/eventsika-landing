/**
 * Eventsika Package & Estimation Configuration
 *
 * Single source of truth for planning tiers, per-person rates, guest presets,
 * and indicative third-party vendor estimates.
 *
 * Planning fees do not include third-party vendor service charges.
 */

export interface PackageTierConfig {
  id: "essential" | "premium" | "luxury";
  name: string;
  pricePerPerson: number;
  tagline: string;
  badge?: string;
  features: string[];
}

export interface AddonConfig {
  id: string;
  name: string;
  price: number;
}

export const MIN_GUEST_COUNT = 10;
export const DEFAULT_GUEST_COUNT = 25;
export const DEFAULT_PACKAGE_ID: PackageTierConfig["id"] = "premium";

export const GUEST_PRESETS: readonly number[] = [10, 15, 25, 50, 75, 100] as const;

export const PACKAGES_CONFIG: PackageTierConfig[] = [
  {
    id: "essential",
    name: "ESSENTIAL",
    pricePerPerson: 1500,
    tagline: "Thoughtful planning support for intimate celebrations.",
    features: [
      "Initial event brief and planning kickoff",
      "Planning checklist and budget-priority guidance",
      "Essential vendor recommendations and coordination",
      "Event-day checklist and timeline guidance",
    ],
  },
  {
    id: "premium",
    name: "PREMIUM",
    pricePerPerson: 2000,
    tagline: "Detailed planning and coordination across your chosen vendors.",
    badge: "MOST POPULAR",
    features: [
      "Detailed celebration plan and budget coordination",
      "Vendor shortlist and coordination across agreed service categories",
      "Detailed event timeline and run-of-show",
      "Event-day coordination oversight",
    ],
  },
  {
    id: "luxury",
    name: "LUXURY",
    pricePerPerson: 2500,
    tagline: "Comprehensive planning for larger or more involved celebrations.",
    features: [
      "Comprehensive celebration planning and budget coordination",
      "Multi-vendor discovery, communication, and coordination",
      "Detailed run-of-show and guest-experience planning",
      "Expanded event-day coordination oversight",
    ],
  },
];

export const ADDONS_CONFIG: AddonConfig[] = [
  {
    id: "live-chaat",
    name: "Live Chaat & Mocktail Corner",
    price: 15000,
  },
  {
    id: "photography-films",
    name: "Photography & Films",
    price: 18000,
  },
  {
    id: "live-music",
    name: "Live Acoustic / Sufi Duo",
    price: 20000,
  },
  {
    id: "hampers",
    name: "Custom Welcome Hampers (50 Boxes)",
    price: 12000,
  },
  {
    id: "valet-concierge",
    name: "Guest Valet & Concierge",
    price: 8000,
  },
];

export function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

export function formatPackageRate(pricePerPerson: number): string {
  return formatCurrency(pricePerPerson) + " / person";
}

export function formatIndicativeVendorEstimate(amount: number): string {
  return "Indicative from " + formatCurrency(amount);
}

export interface PackageEstimate {
  guestCount: number;
  planningFee: number;
  selectedVendorEstimate: number;
  combinedEstimate: number;
}

/**
 * Calculates the Eventsika planning fee plus selected indicative vendor
 * estimates. This is not a confirmed all-inclusive event quotation.
 */
export function calculatePackageEstimate(
  guestCount: number,
  packageId: PackageTierConfig["id"],
  selectedAddonIds: readonly string[] = [],
): PackageEstimate {
  const normalizedGuestCount = Math.max(
    MIN_GUEST_COUNT,
    Math.round(Number.isFinite(guestCount) ? guestCount : MIN_GUEST_COUNT),
  );

  const selectedPackage = PACKAGES_CONFIG.find((pkg) => pkg.id === packageId);
  if (!selectedPackage) {
    throw new Error("Unknown Eventsika package tier: " + packageId);
  }

  const planningFee = normalizedGuestCount * selectedPackage.pricePerPerson;
  const uniqueAddonIds = new Set(selectedAddonIds);
  const selectedVendorEstimate = Array.from(uniqueAddonIds).reduce((sum, id) => {
    const addon = ADDONS_CONFIG.find((item) => item.id === id);
    return sum + (addon ? addon.price : 0);
  }, 0);

  return {
    guestCount: normalizedGuestCount,
    planningFee,
    selectedVendorEstimate,
    combinedEstimate: planningFee + selectedVendorEstimate,
  };
}
