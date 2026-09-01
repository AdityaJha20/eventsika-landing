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

  // 11. WhatsApp Consent
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
    },
  };
}
