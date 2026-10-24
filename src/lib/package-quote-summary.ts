/**
 * Eventsika Stored Package Quote Summaries
 *
 * Describes persisted package quotes for lead notifications and the admin
 * dossier without recalculating them, including historical quotes that use
 * the legacy flat add-on IDs. Server and admin use only: public pages must
 * not import this module.
 */

import {
  calculatePackageEstimate,
  ESTIMATE_DISCLAIMER,
  isOptionalServiceId,
  isPackageTierId,
  OPTIONAL_SERVICES_CONFIG,
  PACKAGES_CONFIG,
  type PackageTierId,
} from "./packages-config";

/**
 * Persisted quote shape. Amounts are whole rupees calculated by the server at
 * submission time. `serviceIds` may contain legacy add-on IDs on historical
 * leads, so it is typed as plain strings.
 */
export interface PackageQuoteRecord {
  tierId: PackageTierId;
  guestCount: number;
  serviceIds: string[];
  packageSubtotalRupees: number;
  servicesSubtotalRupees: number;
  totalEstimateRupees: number;
}

/**
 * Flat-priced vendor add-ons offered before the per-person service model.
 * Kept only so historical leads render with readable names; these are never
 * accepted for new quotes.
 */
export const LEGACY_ADDON_LABELS: Readonly<Record<string, string>> = {
  "live-chaat": "Live Chaat & Mocktail Corner",
  "photography-films": "Photography & Films",
  "live-music": "Live Acoustic / Sufi Duo",
  hampers: "Custom Welcome Hampers (50 Boxes)",
  "valet-concierge": "Guest Valet & Concierge",
};

export function isLegacyAddonId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(LEGACY_ADDON_LABELS, id);
}

export interface PackageQuoteSummaryService {
  id: string;
  name: string;
  /** Null when the per-person rate cannot be shown without recalculating. */
  ratePerPerson: number | null;
  subtotal: number | null;
}

export interface PackageQuoteSummary {
  isLegacyQuote: boolean;
  tierName: string;
  packageLabel: string;
  decorRatePerPerson: number | null;
  guestCount: number;
  packageSubtotal: number;
  servicesLabel: string;
  services: PackageQuoteSummaryService[];
  servicesSubtotal: number;
  perPersonTotal: number | null;
  total: number;
  note: string;
}

const LEGACY_QUOTE_NOTE =
  "Submitted under the previous planning-fee model with flat vendor estimates. Amounts are shown exactly as recorded and have not been recalculated.";

const UNRECONCILED_QUOTE_NOTE =
  "Recorded amounts differ from the current published rates, so per-service rates are not shown. Amounts are shown exactly as recorded.";

/**
 * Summarises a stored quote for display. Recorded amounts are always shown
 * as-is. Per-service rates are only displayed when the current catalog
 * reproduces every recorded amount exactly.
 */
export function summarizePackageQuote(quote: PackageQuoteRecord): PackageQuoteSummary {
  const tierName =
    PACKAGES_CONFIG.find((pkg) => pkg.id === quote.tierId)?.name || quote.tierId;
  const isLegacyQuote = quote.serviceIds.some(isLegacyAddonId);

  const base = {
    tierName,
    guestCount: quote.guestCount,
    packageSubtotal: quote.packageSubtotalRupees,
    servicesSubtotal: quote.servicesSubtotalRupees,
    total: quote.totalEstimateRupees,
  };

  if (isLegacyQuote) {
    return {
      ...base,
      isLegacyQuote: true,
      packageLabel: "Planning & coordination fee (legacy quote)",
      decorRatePerPerson: null,
      servicesLabel: "Legacy flat vendor estimates",
      services: quote.serviceIds.map((id) => ({
        id,
        name: LEGACY_ADDON_LABELS[id]
          ? `${LEGACY_ADDON_LABELS[id]} (legacy flat estimate)`
          : `Unrecognised service (${id})`,
        ratePerPerson: null,
        subtotal: null,
      })),
      perPersonTotal: null,
      note: LEGACY_QUOTE_NOTE,
    };
  }

  const allServicesKnown = quote.serviceIds.every(isOptionalServiceId);
  const estimate =
    isPackageTierId(quote.tierId) && allServicesKnown
      ? calculatePackageEstimate(quote.guestCount, quote.tierId, quote.serviceIds)
      : null;
  const reconciled =
    estimate !== null &&
    estimate.guestCount === quote.guestCount &&
    estimate.services.length === quote.serviceIds.length &&
    estimate.packageSubtotal === quote.packageSubtotalRupees &&
    estimate.servicesSubtotal === quote.servicesSubtotalRupees &&
    estimate.total === quote.totalEstimateRupees;

  const services: PackageQuoteSummaryService[] =
    reconciled && estimate
      ? estimate.services.map((service) => ({
          id: service.id,
          name: service.name,
          ratePerPerson: service.ratePerPerson,
          subtotal: service.subtotal,
        }))
      : quote.serviceIds.map((id) => ({
          id,
          name:
            OPTIONAL_SERVICES_CONFIG.find((service) => service.id === id)?.name ||
            `Unrecognised service (${id})`,
          ratePerPerson: null,
          subtotal: null,
        }));

  const perPersonTotal =
    quote.guestCount > 0 && quote.totalEstimateRupees % quote.guestCount === 0
      ? quote.totalEstimateRupees / quote.guestCount
      : null;

  return {
    ...base,
    isLegacyQuote: false,
    packageLabel: "Decor Package",
    decorRatePerPerson: reconciled && estimate ? estimate.decorRatePerPerson : null,
    servicesLabel: "Selected Optional Services",
    services,
    perPersonTotal,
    note: reconciled ? ESTIMATE_DISCLAIMER : UNRECONCILED_QUOTE_NOTE,
  };
}
