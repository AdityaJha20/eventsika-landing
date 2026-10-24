/**
 * Eventsika Package & Estimation Configuration
 *
 * Single source of truth for the public decor package rates, optional
 * per-person service rates, guest-count limits, and the indicative estimate
 * calculation shared by the UI and the lead API.
 *
 * Every amount here is an approved public selling price in whole rupees.
 * Each base package includes decor only; all other services are optional and
 * charged per guest at the rate for the selected package tier.
 */

export type PackageTierId = "essential" | "premium" | "luxury";

export interface PackageTierConfig {
  id: PackageTierId;
  name: string;
  /** Public decor rate per guest, in whole rupees. */
  pricePerPerson: number;
  tagline: string;
  badge?: string;
  features: string[];
}

export const OPTIONAL_SERVICE_IDS = [
  "food",
  "floral",
  "bartending",
  "housekeeping",
  "valet",
  "light-sound",
  "photography",
  "videography",
] as const;

export type OptionalServiceId = (typeof OPTIONAL_SERVICE_IDS)[number];

export interface OptionalServiceConfig {
  id: OptionalServiceId;
  name: string;
  /** Public rate per guest for each package tier, in whole rupees. */
  ratesPerPerson: Readonly<Record<PackageTierId, number>>;
}

export const MIN_GUEST_COUNT = 10;
export const MAX_GUEST_COUNT = 10000;
export const DEFAULT_GUEST_COUNT = 25;
export const DEFAULT_PACKAGE_ID: PackageTierId = "premium";

export const GUEST_PRESETS: readonly number[] = [10, 15, 25, 50, 75, 100] as const;

export const BASE_PACKAGE_INCLUSION = "Decor only";

/** Shown wherever no public rate has been approved. */
export const CUSTOM_QUOTE_LABEL = "Request a custom quote";

export const ESTIMATE_DISCLAIMER =
  "Indicative estimate only. Each package includes decor only; optional services are charged per guest only when selected. Supplier availability and the final quote require confirmation, and tax treatment will be confirmed in the final quote.";

export const PACKAGES_CONFIG: PackageTierConfig[] = [
  {
    id: "essential",
    name: "Essential",
    pricePerPerson: 1500,
    tagline: "Decor for intimate, beautifully simple celebrations.",
    features: [
      "Decor styled for your occasion",
      "Optional services charged per guest, only if you select them",
      "Final decor scope confirmed in your quote",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    pricePerPerson: 2000,
    tagline: "Richer decor for celebrations with more to style.",
    badge: "MOST POPULAR",
    features: [
      "Premium decor styled for your occasion",
      "Optional services charged per guest, only if you select them",
      "Final decor scope confirmed in your quote",
    ],
  },
  {
    id: "luxury",
    name: "Luxury",
    pricePerPerson: 2500,
    tagline: "Our most elaborate decor for statement celebrations.",
    features: [
      "Luxury decor styled for your occasion",
      "Optional services charged per guest, only if you select them",
      "Final decor scope confirmed in your quote",
    ],
  },
];

export const OPTIONAL_SERVICES_CONFIG: readonly OptionalServiceConfig[] = [
  {
    id: "food",
    name: "Food & catering",
    ratesPerPerson: { essential: 2000, premium: 2600, luxury: 3380 },
  },
  {
    id: "floral",
    name: "Floral styling",
    ratesPerPerson: { essential: 240, premium: 312, luxury: 405 },
  },
  {
    id: "bartending",
    name: "Bartending",
    ratesPerPerson: { essential: 120, premium: 156, luxury: 202 },
  },
  {
    id: "housekeeping",
    name: "Housekeeping",
    ratesPerPerson: { essential: 120, premium: 156, luxury: 202 },
  },
  {
    id: "valet",
    name: "Valet & concierge",
    ratesPerPerson: { essential: 120, premium: 156, luxury: 202 },
  },
  {
    id: "light-sound",
    name: "Light & sound",
    ratesPerPerson: { essential: 200, premium: 260, luxury: 338 },
  },
  {
    id: "photography",
    name: "Photography",
    ratesPerPerson: { essential: 500, premium: 750, luxury: 1000 },
  },
  {
    id: "videography",
    name: "Videography",
    ratesPerPerson: { essential: 1000, premium: 1500, luxury: 2000 },
  },
];

export function isPackageTierId(value: unknown): value is PackageTierId {
  return PACKAGES_CONFIG.some((pkg) => pkg.id === value);
}

export function isOptionalServiceId(value: unknown): value is OptionalServiceId {
  return OPTIONAL_SERVICES_CONFIG.some((service) => service.id === value);
}

export function getPackageTier(tierId: PackageTierId): PackageTierConfig {
  const tier = PACKAGES_CONFIG.find((pkg) => pkg.id === tierId);
  if (!tier) {
    throw new Error("Unknown Eventsika package tier: " + tierId);
  }
  return tier;
}

/** Lowest published per-guest rate for a service across all tiers. */
export function getLowestServiceRate(serviceId: OptionalServiceId): number {
  const service = OPTIONAL_SERVICES_CONFIG.find((item) => item.id === serviceId);
  if (!service) {
    throw new Error("Unknown Eventsika optional service: " + serviceId);
  }
  return Math.min(...PACKAGES_CONFIG.map((pkg) => service.ratesPerPerson[pkg.id]));
}

export function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN");
}

export function formatPerPersonRate(ratePerPerson: number): string {
  return formatCurrency(ratePerPerson) + " / person";
}

export function formatPackageRate(pricePerPerson: number): string {
  return formatPerPersonRate(pricePerPerson);
}

export function clampGuestCount(guestCount: number): number {
  return Math.min(
    MAX_GUEST_COUNT,
    Math.max(
      MIN_GUEST_COUNT,
      Math.round(Number.isFinite(guestCount) ? guestCount : MIN_GUEST_COUNT),
    ),
  );
}

export interface PackageEstimateServiceLine {
  id: OptionalServiceId;
  name: string;
  ratePerPerson: number;
  subtotal: number;
}

export interface PackageEstimate {
  tierId: PackageTierId;
  guestCount: number;
  decorRatePerPerson: number;
  packageSubtotal: number;
  services: PackageEstimateServiceLine[];
  servicesRatePerPerson: number;
  servicesSubtotal: number;
  perPersonTotal: number;
  total: number;
}

/**
 * Calculates the indicative event estimate:
 *
 *   perPersonTotal = decor rate + sum(selected optional service rates)
 *   total          = guestCount × perPersonTotal
 *
 * Unknown and duplicate service IDs are ignored so a service is never charged
 * twice. Service lines are returned in catalog order. This is not a confirmed
 * final quotation.
 */
export function calculatePackageEstimate(
  guestCount: number,
  tierId: PackageTierId,
  selectedServiceIds: readonly string[] = [],
): PackageEstimate {
  const normalizedGuestCount = clampGuestCount(guestCount);
  const tier = getPackageTier(tierId);
  const selected = new Set(selectedServiceIds);

  const services = OPTIONAL_SERVICES_CONFIG.filter((service) =>
    selected.has(service.id),
  ).map((service) => {
    const ratePerPerson = service.ratesPerPerson[tier.id];
    return {
      id: service.id,
      name: service.name,
      ratePerPerson,
      subtotal: normalizedGuestCount * ratePerPerson,
    };
  });

  const servicesRatePerPerson = services.reduce(
    (sum, service) => sum + service.ratePerPerson,
    0,
  );
  const perPersonTotal = tier.pricePerPerson + servicesRatePerPerson;

  return {
    tierId: tier.id,
    guestCount: normalizedGuestCount,
    decorRatePerPerson: tier.pricePerPerson,
    packageSubtotal: normalizedGuestCount * tier.pricePerPerson,
    services,
    servicesRatePerPerson,
    servicesSubtotal: normalizedGuestCount * servicesRatePerPerson,
    perPersonTotal,
    total: normalizedGuestCount * perPersonTotal,
  };
}
