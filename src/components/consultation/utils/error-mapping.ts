/**
 * Friendly Error Mapping Utilities (Step 5)
 *
 * Translates backend error codes and HTTP failure responses into
 * courteous, actionable messages for luxury consultation guests.
 * Ensures zero internal error details, tokens, or stack traces leak.
 */

export function mapBookingError(
  errorCodeOrMessage?: string,
  statusCode?: number
): string {
  if (statusCode === 429) {
    return "You have made several attempts in a short time. Please wait a few moments before trying again.";
  }

  if (statusCode === 403) {
    return "Session security validation could not be completed. Please refresh the page and try again.";
  }

  if (statusCode === 413) {
    return "The submission payload was too large. Please shorten your notes and try again.";
  }

  if (!errorCodeOrMessage) {
    return "We encountered a momentary issue processing your request. Please try again.";
  }

  const code = errorCodeOrMessage.trim().toUpperCase();

  switch (code) {
    case "SLOT_UNAVAILABLE":
      return "This celebration slot was just reserved by another guest. Please select an alternative available time.";

    case "SLOT_PAST_LEAD_TIME":
      return "Consultation slots require at least 24 hours advance booking to ensure proper curator preparation.";

    case "INVALID_SLOT":
    case "SLOT_NOT_FOUND":
      return "The requested consultation slot is no longer available in our schedule. Please pick a new slot.";

    case "RESERVATION_EXPIRING_SOON":
      return "Your 15-minute slot hold has less than 2 minutes remaining. To avoid payment interruption, please select a fresh slot.";

    case "RESERVATION_EXPIRED":
    case "PAYMENT_ORDER_EXPIRED":
      return "Your temporary 15-minute reservation hold has expired. Please select a slot to reserve a fresh consultation window.";

    case "INVALID_RESERVATION_TOKEN":
      return "Your reservation session token is no longer valid. Please start a fresh reservation.";

    case "PAYMENT_ALREADY_COMPLETED":
      return "Payment for this consultation has already been recorded. Our team is preparing your session.";

    case "GATEWAY_TIMEOUT":
      return "The payment provider connection took too long to respond. Please click 'Proceed to Payment' to retry safely.";

    case "GATEWAY_ERROR":
      return "The payment gateway is momentarily experiencing high traffic. Please retry in a few seconds.";

    case "VALIDATION_ERROR":
      return "Please review your contact details and ensure all required fields are accurately filled.";

    default:
      if (errorCodeOrMessage.length > 5 && errorCodeOrMessage.length < 120 && !errorCodeOrMessage.includes("Error:")) {
        return errorCodeOrMessage;
      }
      return "An unexpected issue occurred while coordinating your consultation. Please try again.";
  }
}
