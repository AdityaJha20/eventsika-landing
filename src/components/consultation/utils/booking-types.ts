/**
 * Customer Consultation Booking & Payment Domain Types (Step 5)
 *
 * Defines strongly-typed UI state transitions, reservation sessions,
 * and customer intake structures adhering to locked backend contracts.
 */

export type BookingStep = "slot" | "details" | "payment" | "confirm";

export type BookingUiState =
  | "IDLE"
  | "LOADING_SLOTS"
  | "SLOT_SELECTION"
  | "CUSTOMER_DETAILS"
  | "RESERVING"
  | "RESERVED"
  | "CREATING_PAYMENT"
  | "CHECKOUT_OPEN"
  | "CHECKOUT_CLOSED"
  | "PAYMENT_PENDING"
  | "RESERVATION_EXPIRING"
  | "RESERVATION_EXPIRED"
  | "ERROR";

export interface ConsultationSlotDto {
  id: string;
  startTime: string; // ISO 8601 UTC
  endTime: string;   // ISO 8601 UTC
}

export interface CustomerFormData {
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail: string;
  customerCity: string;
  eventType: string;
  eventTypeOther: string;
  guestCount: string;
  eventDateApprox: string;
  meetingChannel: "phone" | "video";
}

export interface ActiveReservationSession {
  consultationId: string;
  slotId: string;
  reservationToken: string;
  reservedUntil: string; // ISO 8601 UTC from server
  expiresInSeconds: number;
  slotStartTime: string;
  slotEndTime: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCity: string;
  eventType: string;
  meetingChannel: "phone" | "video";
}

/** Server-created Razorpay checkout parameters (amount is server-authoritative). */
export interface PaymentOrderResponseData {
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency: "INR";
  reference: string;
  prefill: { name: string; email: string; contact: string };
  /** Seconds left on the server-held reservation when the order response was built. */
  reservationExpiresInSeconds: number;
}

export type CustomerPaymentState =
  | "awaiting_payment"
  | "verifying"
  | "paid"
  | "failed"
  | "expired"
  | "refund_processing"
  | "partially_refunded"
  | "refunded";

export type CustomerBookingState =
  | "pending"
  | "confirmed"
  | "action_required"
  | "cancelled"
  | "completed"
  | "no_show"
  | "rescheduled";

export interface CustomerPaymentStatusDto {
  payment: CustomerPaymentState;
  booking: CustomerBookingState;
  slotStartTime: string | null;
  amountInPaise: number;
  reference: string | null;
  canRetryPayment: boolean;
}

/** Minimal credentials needed to look a booking up again (kept in sessionStorage). */
export interface BookingRecoveryHandle {
  consultationId: string;
  reservationToken: string;
}

export type CountdownStatus = "normal" | "warning" | "critical" | "expired";
