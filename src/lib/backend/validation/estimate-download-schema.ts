import {
  calculatePackageEstimate,
  isOptionalServiceId,
  isPackageTierId,
  MAX_GUEST_COUNT,
  MIN_GUEST_COUNT,
  OPTIONAL_SERVICE_IDS,
  type OptionalServiceId,
  type PackageTierId,
} from "../../packages-config";
import {
  buildPackageEstimateSnapshot,
  type PackageEstimateSnapshot,
} from "../../package-quote-summary";
import {
  ESTIMATE_DOWNLOAD_CONSENT_VERSION,
  parseEstimateContact,
} from "../../estimate-download-contact";

const ALLOWED_KEYS = new Set([
  "contact",
  "packageTier",
  "guestCount",
  "serviceIds",
  "consentToContact",
  "consentTextVersion",
  "idempotencyKey",
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidatedEstimateDownload {
  contactType: "phone" | "email";
  contactValue: string;
  packageTier: PackageTierId;
  guestCount: number;
  serviceIds: OptionalServiceId[];
  /** Calculated here from packages-config; never taken from the request. */
  snapshot: PackageEstimateSnapshot;
  totalEstimateRupees: number;
  consentTextVersion: string;
  idempotencyKey: string;
}

export type EstimateDownloadValidationResult =
  | { success: true; data: ValidatedEstimateDownload }
  | { success: false; error: string };

const fail = (error: string): EstimateDownloadValidationResult => ({ success: false, error });

/**
 * Strict validation for POST /api/estimate-downloads. Unknown keys (including
 * any client-sent prices or totals) are rejected, not ignored.
 * Error messages never echo the submitted contact value.
 */
export function validateEstimateDownloadInput(raw: unknown): EstimateDownloadValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("Invalid request payload format.");
  }
  const payload = raw as Record<string, unknown>;

  if (Object.keys(payload).some((key) => !ALLOWED_KEYS.has(key))) {
    return fail("Unexpected fields in request.");
  }

  const contact = parseEstimateContact(payload.contact);
  if (!contact.ok) return fail(contact.error);

  if (payload.consentToContact !== true) {
    return fail("Please agree to be contacted about this estimate.");
  }
  if (payload.consentTextVersion !== ESTIMATE_DOWNLOAD_CONSENT_VERSION) {
    return fail("The consent wording has changed. Please reload the page and try again.");
  }

  if (!isPackageTierId(payload.packageTier)) return fail("Invalid package selection.");

  const guestCount = payload.guestCount;
  if (
    typeof guestCount !== "number" ||
    !Number.isInteger(guestCount) ||
    guestCount < MIN_GUEST_COUNT ||
    guestCount > MAX_GUEST_COUNT
  ) {
    return fail("Invalid guest count.");
  }

  const serviceIds = payload.serviceIds;
  if (
    !Array.isArray(serviceIds) ||
    serviceIds.length > OPTIONAL_SERVICE_IDS.length ||
    !serviceIds.every(isOptionalServiceId)
  ) {
    return fail("One or more optional service selections are invalid.");
  }
  if (new Set(serviceIds).size !== serviceIds.length) {
    return fail("Duplicate optional service selections are not allowed.");
  }

  if (typeof payload.idempotencyKey !== "string" || !UUID_REGEX.test(payload.idempotencyKey)) {
    return fail("Invalid request key.");
  }

  const estimate = calculatePackageEstimate(guestCount, payload.packageTier, serviceIds);

  return {
    success: true,
    data: {
      contactType: contact.kind,
      contactValue: contact.value,
      packageTier: estimate.tierId,
      guestCount: estimate.guestCount,
      serviceIds: estimate.services.map((service) => service.id),
      snapshot: buildPackageEstimateSnapshot(estimate),
      totalEstimateRupees: estimate.total,
      consentTextVersion: ESTIMATE_DOWNLOAD_CONSENT_VERSION,
      idempotencyKey: payload.idempotencyKey.toLowerCase(),
    },
  };
}
