/**
 * Eventsika Package Quote Handoff Helpers
 *
 * Carries a customizer selection (tier, exact guest count, selected optional
 * service IDs) into the lead form via URL parameters. This module ships in
 * public page bundles, so it must only reference the current public catalog;
 * stored-quote and legacy display logic lives in `package-quote-summary.ts`.
 */

import type { GuestCountOption, ServiceOption } from "./backend/constants/allowlists";
import {
  isOptionalServiceId,
  isPackageTierId,
  MAX_GUEST_COUNT,
  MIN_GUEST_COUNT,
  type OptionalServiceId,
  type PackageTierId,
} from "./packages-config";

export interface PackageQuoteSelection {
  tierId: PackageTierId;
  guestCount: number;
  serviceIds: OptionalServiceId[];
}

const SERVICE_OPTION_FOR_SERVICE: Readonly<Record<OptionalServiceId, ServiceOption>> = {
  food: "Food & Catering",
  floral: "Decor & Styling",
  bartending: "Food & Catering",
  housekeeping: "More",
  valet: "More",
  "light-sound": "Music & Entertainment",
  photography: "Photography & Films",
  videography: "Photography & Films",
};

export function buildPackageQuoteHref(selection: PackageQuoteSelection): string {
  return `/?package=${selection.tierId}&packageGuests=${selection.guestCount}&packageAddons=${selection.serviceIds.join(",")}#plan-event`;
}

/**
 * Parses a `?package=…&packageGuests=…&packageAddons=…` search string. Returns
 * null for anything that is not a complete, current selection so the form
 * falls back to an ordinary enquiry.
 */
export function parsePackageQuoteSearch(search: string): PackageQuoteSelection | null {
  const params = new URLSearchParams(search);
  const tierId = params.get("package");
  const rawGuestCount = params.get("packageGuests");
  const rawServiceIds = params.get("packageAddons") || "";

  if (!isPackageTierId(tierId) || rawGuestCount === null) return null;

  const guestCount = Number(rawGuestCount);
  const serviceIds = rawServiceIds ? rawServiceIds.split(",") : [];

  if (
    !Number.isInteger(guestCount) ||
    guestCount < MIN_GUEST_COUNT ||
    guestCount > MAX_GUEST_COUNT ||
    !serviceIds.every(isOptionalServiceId) ||
    new Set(serviceIds).size !== serviceIds.length
  ) {
    return null;
  }

  return { tierId, guestCount, serviceIds };
}

export function guestCountRangeFor(count: number): GuestCountOption {
  if (count <= 10) return "2–10 guests";
  if (count <= 30) return "10–30 guests";
  if (count <= 50) return "30–50 guests";
  if (count <= 100) return "50–100 guests";
  if (count <= 200) return "100–200 guests";
  return "200+ guests";
}

/**
 * Lead-form service categories implied by a package quote. Every package
 * includes decor, so "Decor & Styling" is always present.
 */
export function serviceOptionsForPackageQuote(
  serviceIds: readonly OptionalServiceId[],
): ServiceOption[] {
  return Array.from(
    new Set<ServiceOption>([
      "Decor & Styling",
      ...serviceIds.map((id) => SERVICE_OPTION_FOR_SERVICE[id]),
    ]),
  );
}
