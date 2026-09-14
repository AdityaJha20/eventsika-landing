import { validateIndianPhone } from "./phone";
import { MeetingChannel, MEETING_CHANNELS } from "../types/payment-and-consultation";

export interface RawConsultationInput {
  customerFirstName?: unknown;
  customerLastName?: unknown;
  customerPhone?: unknown;
  customerEmail?: unknown;
  customerCity?: unknown;
  eventType?: unknown;
  eventTypeOther?: unknown;
  guestCount?: unknown;
  eventDateApprox?: unknown;
  meetingChannel?: unknown;
  slotId?: unknown;
}

export interface ValidatedConsultationInput {
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
  customerCity: string;
  eventType: string;
  eventTypeOther: string | null;
  guestCount: string | null;
  eventDateApprox: string | null;
  meetingChannel: MeetingChannel;
  slotId: string | null;
}

export type ConsultationValidationResult =
  | { success: true; data: ValidatedConsultationInput }
  | { success: false; error: string };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates raw consultation customer intake payload against locked business rules.
 */
export function validateConsultationInput(raw: unknown): ConsultationValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "Invalid request payload format." };
  }

  const payload = raw as RawConsultationInput;

  // 1. Customer First Name (Required, 1-60 chars)
  if (typeof payload.customerFirstName !== "string" || !payload.customerFirstName.trim()) {
    return { success: false, error: "Please enter your first name." };
  }
  const customerFirstName = payload.customerFirstName.trim();
  if (customerFirstName.length > 60) {
    return { success: false, error: "First name must not exceed 60 characters." };
  }

  // 2. Customer Last Name (Required, 1-60 chars)
  if (typeof payload.customerLastName !== "string" || !payload.customerLastName.trim()) {
    return { success: false, error: "Please enter your last name." };
  }
  const customerLastName = payload.customerLastName.trim();
  if (customerLastName.length > 60) {
    return { success: false, error: "Last name must not exceed 60 characters." };
  }

  // 3. Customer Phone (Required, validated Indian format)
  const phoneResult = validateIndianPhone(payload.customerPhone);
  if (!phoneResult.isValid) {
    return { success: false, error: phoneResult.error || "Please enter a valid 10-digit phone number." };
  }
  const customerPhone = phoneResult.normalizedPhone;

  // 4. Customer Email (Required, RFC 5321 length & format)
  if (typeof payload.customerEmail !== "string" || !payload.customerEmail.trim()) {
    return { success: false, error: "Please enter your email address." };
  }
  const customerEmail = payload.customerEmail.trim().toLowerCase();
  if (customerEmail.length < 5 || customerEmail.length > 150 || !EMAIL_REGEX.test(customerEmail)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  // 5. Customer City (Required, 1-100 chars)
  if (typeof payload.customerCity !== "string" || !payload.customerCity.trim()) {
    return { success: false, error: "Please enter your city." };
  }
  const customerCity = payload.customerCity.trim();
  if (customerCity.length > 100) {
    return { success: false, error: "City must not exceed 100 characters." };
  }

  // 6. Event Type (Required, 1-50 chars)
  if (typeof payload.eventType !== "string" || !payload.eventType.trim()) {
    return { success: false, error: "Please select an event occasion." };
  }
  const eventType = payload.eventType.trim();
  if (eventType.length > 50) {
    return { success: false, error: "Event occasion must not exceed 50 characters." };
  }

  // 7. Event Type Other (Optional, 0-100 chars)
  let eventTypeOther: string | null = null;
  if (typeof payload.eventTypeOther === "string" && payload.eventTypeOther.trim()) {
    eventTypeOther = payload.eventTypeOther.trim();
    if (eventTypeOther.length > 100) {
      return { success: false, error: "Custom celebration details must not exceed 100 characters." };
    }
  }

  // 8. Guest Count (Optional, 0-50 chars)
  let guestCount: string | null = null;
  if (typeof payload.guestCount === "string" && payload.guestCount.trim()) {
    guestCount = payload.guestCount.trim();
    if (guestCount.length > 50) {
      return { success: false, error: "Guest count must not exceed 50 characters." };
    }
  }

  // 9. Event Date Approx (Optional, 0-50 chars)
  let eventDateApprox: string | null = null;
  if (typeof payload.eventDateApprox === "string" && payload.eventDateApprox.trim()) {
    eventDateApprox = payload.eventDateApprox.trim();
    if (eventDateApprox.length > 50) {
      return { success: false, error: "Approximate event date must not exceed 50 characters." };
    }
  }

  // 10. Meeting Channel (Required: 'phone' or 'video')
  if (typeof payload.meetingChannel !== "string" || !payload.meetingChannel.trim()) {
    return { success: false, error: "Please select your preferred meeting channel (Phone or Video)." };
  }
  const meetingChannel = payload.meetingChannel.trim().toLowerCase() as MeetingChannel;
  if (!MEETING_CHANNELS.includes(meetingChannel)) {
    return { success: false, error: "Invalid meeting channel. Please choose either Phone or Video." };
  }

  // 11. Slot ID (Optional in foundation, must be valid UUID if provided)
  let slotId: string | null = null;
  if (payload.slotId !== undefined && payload.slotId !== null) {
    if (typeof payload.slotId !== "string" || !UUID_REGEX.test(payload.slotId.trim())) {
      return { success: false, error: "Invalid consultation slot identifier format." };
    }
    slotId = payload.slotId.trim();
  }

  return {
    success: true,
    data: {
      customerFirstName,
      customerLastName,
      customerPhone,
      customerEmail,
      customerCity,
      eventType,
      eventTypeOther,
      guestCount,
      eventDateApprox,
      meetingChannel,
      slotId,
    },
  };
}
