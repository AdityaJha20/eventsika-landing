import {
  CITY_OPTIONS,
  EVENT_TYPE_OPTIONS,
  GUEST_COUNT_OPTIONS,
  VENUE_TYPE_OPTIONS,
  SERVICE_OPTIONS,
  BUDGET_OPTIONS,
  CityOption,
  EventTypeOption,
  GuestCountOption,
  VenueTypeOption,
  ServiceOption,
  BudgetOption,
} from "../constants/allowlists";
import { ADDONS_CONFIG, calculatePackageEstimate, PACKAGES_CONFIG, type PackageTierConfig } from "../../packages-config";
import { validateIndianPhone } from "./phone";
import { validateEventDate } from "./date";

export interface RawLeadPayload {
  userName?: unknown;
  userPhone?: unknown;
  city?: unknown;
  eventType?: unknown;
  eventDate?: unknown;
  guestCount?: unknown;
  venueType?: unknown;
  selectedServices?: unknown;
  budgetRange?: unknown;
  whatsappConsent?: unknown;
  honeypot?: unknown;
  packageTier?: unknown;
  packageGuestCount?: unknown;
  packageVendorAddonIds?: unknown;
}

export interface ValidatedPackageQuote {
  tierId: PackageTierConfig["id"];
  guestCount: number;
  vendorAddonIds: string[];
  planningFeeRupees: number;
  vendorEstimateRupees: number;
  combinedEstimateRupees: number;
}

export interface ValidatedLeadInput {
  userName: string;
  userPhone: string;
  city: CityOption;
  eventType: EventTypeOption;
  eventDate: string;
  guestCount: GuestCountOption;
  venueType: VenueTypeOption;
  selectedServices: ServiceOption[];
  budgetRange: BudgetOption;
  whatsappConsent: boolean;
  isBot: boolean;
  packageQuote: ValidatedPackageQuote | null;
}

export type LeadValidationResult =
  | { success: true; data: ValidatedLeadInput }
  | { success: false; error: string };

/**
 * Validates and sanitizes a raw lead inquiry payload.
 */
export function validateLeadInput(raw: unknown): LeadValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Invalid request payload format." };
  }

  const payload = raw as RawLeadPayload;

  // 1. Honeypot check
  const honeypot = typeof payload.honeypot === "string" ? payload.honeypot.trim() : "";
  const isBot = honeypot.length > 0;

  // If honeypot triggered, return early with isBot flag (safe silent acknowledge)
  if (isBot) {
    return {
      success: true,
      data: {
        userName: "",
        userPhone: "",
        city: "Other",
        eventType: "Other Celebration",
        eventDate: "",
        guestCount: "2–10 guests",
        venueType: "Indoor",
        selectedServices: [],
        budgetRange: "₹25,000 – ₹50,000",
        whatsappConsent: false,
        isBot: true,
        packageQuote: null,
      },
    };
  }

  // 2. User Name
  if (typeof payload.userName !== "string" || !payload.userName.trim()) {
    return { success: false, error: "Please provide your name." };
  }
  const userName = payload.userName.trim();
  if (userName.length > 100) {
    return { success: false, error: "Name must not exceed 100 characters." };
  }

  // 3. User Phone
  const phoneResult = validateIndianPhone(payload.userPhone);
  if (!phoneResult.isValid) {
    return { success: false, error: phoneResult.error || "Please enter a valid 10-digit phone number." };
  }
  const userPhone = phoneResult.normalizedPhone;

  // 4. City Allowlist
  if (typeof payload.city !== "string" || !payload.city.trim()) {
    return { success: false, error: "Please select your city." };
  }
  const city = payload.city.trim() as CityOption;
  if (!CITY_OPTIONS.includes(city)) {
    return {
      success: false,
      error: `Invalid city selection. Allowed options: ${CITY_OPTIONS.join(", ")}.`,
    };
  }

  // 5. Event Type Allowlist
  if (typeof payload.eventType !== "string" || !payload.eventType.trim()) {
    return { success: false, error: "Please select your event occasion." };
  }
  const eventType = payload.eventType.trim() as EventTypeOption;
  if (!EVENT_TYPE_OPTIONS.includes(eventType)) {
    return {
      success: false,
      error: "Please select a valid event occasion from the available list.",
    };
  }

  // 6. Event Date Sanity & Format
  const dateResult = validateEventDate(payload.eventDate);
  if (!dateResult.isValid) {
    return { success: false, error: dateResult.error || "Please provide a valid planned event date." };
  }
  const eventDate = dateResult.normalizedDate;

  // 7. Guest Count Allowlist
  if (typeof payload.guestCount !== "string" || !payload.guestCount.trim()) {
    return { success: false, error: "Please specify your expected guest count." };
  }
  const guestCount = payload.guestCount.trim() as GuestCountOption;
  if (!GUEST_COUNT_OPTIONS.includes(guestCount)) {
    return {
      success: false,
      error: "Please select a valid guest count range.",
    };
  }

  // 8. Venue Type Allowlist
  if (typeof payload.venueType !== "string" || !payload.venueType.trim()) {
    return { success: false, error: "Please select your venue type." };
  }
  const venueType = payload.venueType.trim() as VenueTypeOption;
  if (!VENUE_TYPE_OPTIONS.includes(venueType)) {
    return {
      success: false,
      error: "Please select a valid venue type (Indoor or Outdoor).",
    };
  }

  // 9. Selected Services Allowlist
  if (!Array.isArray(payload.selectedServices) || payload.selectedServices.length === 0) {
    return { success: false, error: "Please select at least one required service." };
  }
  const selectedServices: ServiceOption[] = [];
  for (const s of payload.selectedServices) {
    if (typeof s === "string" && s.trim()) {
      const trimmed = s.trim() as ServiceOption;
      if (SERVICE_OPTIONS.includes(trimmed)) {
        if (!selectedServices.includes(trimmed)) {
          selectedServices.push(trimmed);
        }
      } else {
        return {
          success: false,
          error: `Unknown service requested: "${trimmed}".`,
        };
      }
    }
  }
  if (selectedServices.length === 0) {
    return { success: false, error: "Please select at least one valid celebration service." };
  }

  // 10. Budget Range Allowlist
  if (typeof payload.budgetRange !== "string" || !payload.budgetRange.trim()) {
    return { success: false, error: "Please select your planned budget range." };
  }
  const budgetRange = payload.budgetRange.trim() as BudgetOption;
  if (!BUDGET_OPTIONS.includes(budgetRange)) {
    return {
      success: false,
      error: "Please select a valid planned budget range.",
    };
  }

  // 11. Optional package quote. All monetary values are recomputed server-side.
  const hasPackageTier =
    payload.packageTier !== undefined &&
    payload.packageTier !== null &&
    payload.packageTier !== "";
  const hasPackageGuestCount =
    payload.packageGuestCount !== undefined &&
    payload.packageGuestCount !== null &&
    payload.packageGuestCount !== "";
  const hasVendorAddonSelection =
    Array.isArray(payload.packageVendorAddonIds) &&
    payload.packageVendorAddonIds.length > 0;
  const packageQuoteRequested =
    hasPackageTier || hasPackageGuestCount || hasVendorAddonSelection;

  let packageQuote: ValidatedPackageQuote | null = null;

  if (packageQuoteRequested) {
    const selectedTier = PACKAGES_CONFIG.find(
      (pkg) => pkg.id === payload.packageTier
    );

    if (!selectedTier) {
      return { success: false, error: "Please select a valid planning package." };
    }

    if (
      typeof payload.packageGuestCount !== "number" ||
      !Number.isInteger(payload.packageGuestCount) ||
      payload.packageGuestCount < 10 ||
      payload.packageGuestCount > 10000
    ) {
      return {
        success: false,
        error: "Package guest count must be a whole number between 10 and 10,000.",
      };
    }

    if (
      payload.packageVendorAddonIds !== undefined &&
      payload.packageVendorAddonIds !== null &&
      !Array.isArray(payload.packageVendorAddonIds)
    ) {
      return { success: false, error: "Invalid vendor estimate selection." };
    }

    const rawAddonIds = Array.isArray(payload.packageVendorAddonIds)
      ? payload.packageVendorAddonIds
      : [];

    if (
      rawAddonIds.length > ADDONS_CONFIG.length ||
      rawAddonIds.some(
        (id) =>
          typeof id !== "string" ||
          !ADDONS_CONFIG.some((addon) => addon.id === id)
      )
    ) {
      return { success: false, error: "One or more vendor estimate selections are invalid." };
    }

    const vendorAddonIds = Array.from(new Set(rawAddonIds as string[]));
    const estimate = calculatePackageEstimate(
      payload.packageGuestCount,
      selectedTier.id,
      vendorAddonIds
    );

    packageQuote = {
      tierId: selectedTier.id,
      guestCount: estimate.guestCount,
      vendorAddonIds,
      planningFeeRupees: estimate.planningFee,
      vendorEstimateRupees: estimate.selectedVendorEstimate,
      combinedEstimateRupees: estimate.combinedEstimate,
    };
  }

  // 12. WhatsApp Consent
  const whatsappConsent = Boolean(payload.whatsappConsent);
  if (!whatsappConsent) {
    return {
      success: false,
      error: "Please agree to be contacted on WhatsApp to proceed.",
    };
  }

  return {
    success: true,
    data: {
      userName,
      userPhone,
      city,
      eventType,
      eventDate,
      guestCount,
      venueType,
      selectedServices,
      budgetRange,
      whatsappConsent,
      isBot: false,
      packageQuote,
    },
  };
}
