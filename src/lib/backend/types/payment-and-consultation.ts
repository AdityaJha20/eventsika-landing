/**
 * Payment & Consultation Domain Contracts & Types (Step 1 Foundation)
 *
 * Defines authoritative domain records, status enums, and persistence DTOs
 * strictly enforcing integer paise, independent state machines, and decoupled boundaries.
 */

// ==============================================================================
// 1. Slot Inventory Domain
// ==============================================================================

export const SLOT_STATUSES = [
  "available",
  "reserved",
  "booked",
  "blocked",
] as const;

export type SlotStatus = (typeof SLOT_STATUSES)[number];

export interface ConsultationSlotRecord {
  id: string;
  startTime: string; // ISO 8601 UTC
  endTime: string;   // ISO 8601 UTC
  status: SlotStatus;
  reservedUntil: string | null;
  reservationToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsultationSlotInput {
  startTime: string;
  endTime: string;
  status?: SlotStatus;
  reservedUntil?: string | null;
  reservationToken?: string | null;
}

// ==============================================================================
// 2. Consultation Service Domain
// ==============================================================================

export const MEETING_CHANNELS = ["phone", "video"] as const;
export type MeetingChannel = (typeof MEETING_CHANNELS)[number];

export const CONSULTATION_STATUSES = [
  "draft",
  "slot_held",
  "awaiting_payment",
  "confirmed",
  "slot_conflict_pending_reschedule",
  "rescheduled",
  "completed",
  "cancelled_customer",
  "cancelled_eventsika",
  "no_show",
] as const;

export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

export interface ConsultationRecord {
  id: string;
  slotId: string | null;
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
  status: ConsultationStatus;
  cancellationReason: string | null;
  rescheduledFromId: string | null;
  rescheduleCount: number;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsultationInput {
  slotId?: string | null;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
  customerCity: string;
  eventType: string;
  eventTypeOther?: string | null;
  guestCount?: string | null;
  eventDateApprox?: string | null;
  meetingChannel: MeetingChannel;
  status?: ConsultationStatus;
  requestId?: string | null;
}

// ==============================================================================
// 3. Payment Order Domain
// ==============================================================================

export const PAYMENT_ORDER_STATUSES = [
  "created",
  "attempted",
  "paid",
  "failed",
  "expired",
] as const;

export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

export interface PaymentOrderRecord {
  id: string;
  consultationId: string;
  gatewayOrderId: string | null;
  amountInPaise: number;
  currency: "INR";
  status: PaymentOrderStatus;
  expiresAt: string | null;
  paidAt: string | null;
  requestId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentOrderInput {
  consultationId: string;
  amountInPaise: number;
  currency?: "INR";
  gatewayOrderId?: string | null;
  expiresAt?: string | null;
  requestId?: string | null;
}

// ==============================================================================
// 4. Payment Transaction Domain
// ==============================================================================

export const PAYMENT_TRANSACTION_STATUSES = [
  "pending",
  "success",
  "failed",
  "user_dropped",
] as const;

export type PaymentTransactionStatus = (typeof PAYMENT_TRANSACTION_STATUSES)[number];

export const PAYMENT_METHODS = [
  "upi",
  "card",
  "netbanking",
  "wallet",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface PaymentTransactionRecord {
  id: string;
  paymentOrderId: string;
  gatewayPaymentId: string | null;
  amountInPaise: number;
  feeInPaise: number | null;
  taxInPaise: number | null;
  status: PaymentTransactionStatus;
  paymentMethod: PaymentMethod | null;
  bankReference: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  createdAt: string;
}

export interface CreatePaymentTransactionInput {
  paymentOrderId: string;
  amountInPaise: number;
  gatewayPaymentId?: string | null;
  feeInPaise?: number | null;
  taxInPaise?: number | null;
  status?: PaymentTransactionStatus;
  paymentMethod?: PaymentMethod | null;
  bankReference?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
}

// ==============================================================================
// 5. Payment Refund Domain
// ==============================================================================

export const PAYMENT_REFUND_STATUSES = [
  "pending",
  "initiated",
  "succeeded",
  "failed",
] as const;

export type PaymentRefundStatus = (typeof PAYMENT_REFUND_STATUSES)[number];

export const REFUND_INITIATORS = [
  "customer",
  "admin",
  "system_conflict",
] as const;

export type RefundInitiator = (typeof REFUND_INITIATORS)[number];

export interface PaymentRefundRecord {
  id: string;
  paymentOrderId: string;
  paymentTransactionId: string | null;
  consultationId: string;
  gatewayRefundId: string | null;
  amountInPaise: number;
  status: PaymentRefundStatus;
  reason: string;
  initiatedBy: RefundInitiator;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRefundInput {
  paymentOrderId: string;
  consultationId: string;
  amountInPaise: number;
  reason: string;
  initiatedBy: RefundInitiator;
  paymentTransactionId?: string | null;
  gatewayRefundId?: string | null;
}

// ==============================================================================
// 6. Webhook Event Domain
// ==============================================================================

export const WEBHOOK_EVENT_STATUSES = [
  "received",
  "processed",
  "ignored",
  "failed",
] as const;

export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

export interface WebhookEventRecord {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signature: string;
  status: WebhookEventStatus;
  processingError: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface CreateWebhookEventInput {
  provider?: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signature: string;
  status?: WebhookEventStatus;
}

// ==============================================================================
// 7. Domain Constants
// ==============================================================================

export const DEFAULT_CONSULTATION_PRICE_PAISE = 299900; // ₹2,999 in integer paise
export const CONSULTATION_DURATION_MINUTES = 60;
export const CONSULTATION_BUFFER_MINUTES = 30;
export const CONSULTATION_TIMEZONE = "Asia/Kolkata";
export const MIN_BOOKING_LEAD_TIME_HOURS = 24;
export const ROLLING_AVAILABILITY_DAYS = 30;
export const RESERVATION_HOLD_DURATION_MINUTES = 15;

export interface DailySlotTimeConfig {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export const DAILY_CONSULTATION_SLOTS_IST: readonly DailySlotTimeConfig[] = [
  { startHour: 10, startMinute: 0, endHour: 11, endMinute: 0 },
  { startHour: 11, startMinute: 30, endHour: 12, endMinute: 30 },
  { startHour: 14, startMinute: 0, endHour: 15, endMinute: 0 },
  { startHour: 15, startMinute: 30, endHour: 16, endMinute: 30 },
  { startHour: 17, startMinute: 0, endHour: 18, endMinute: 0 },
  { startHour: 18, startMinute: 30, endHour: 19, endMinute: 30 },
] as const;

// ==============================================================================
// 8. Step 2 Booking & Slot Engine Contracts
// ==============================================================================

export type BookingServiceErrorCode =
  | "SLOT_UNAVAILABLE"
  | "SLOT_PAST_LEAD_TIME"
  | "INVALID_SLOT"
  | "VALIDATION_ERROR"
  | "DATABASE_ERROR";

export interface AvailableSlotDto {
  id: string;
  startTime: string; // ISO UTC
  endTime: string;   // ISO UTC
}

export interface SlotReservationSuccess {
  success: true;
  consultationId: string;
  slotId: string;
  reservationToken: string;
  reservedUntil: string; // ISO UTC
  expiresInSeconds: number;
}

export interface SlotReservationFailure {
  success: false;
  error: BookingServiceErrorCode;
  message: string;
}

export type SlotReservationResult = SlotReservationSuccess | SlotReservationFailure;
