import { after, NextRequest, NextResponse } from "next/server";
import { guardPublicJsonPost } from "@/lib/backend/http/public-json-route";
import { validateCheckoutVerification } from "@/lib/backend/validation/payment-verification-schema";
import {
  CheckoutVerificationError,
  paymentConfirmationService,
} from "@/lib/backend/services/payment-confirmation-service";
import { paymentNotificationService } from "@/lib/backend/services/payment-notification-service";
import { paymentStatusService } from "@/lib/backend/services/payment-status-service";
import { logger } from "@/lib/backend/logger/logger";

export const dynamic = "force-dynamic";

const STATUS: Record<CheckoutVerificationError, number> = {
  ORDER_NOT_FOUND: 404,
  INVALID_RESERVATION_TOKEN: 404,
  SIGNATURE_INVALID: 400,
  PAYMENT_NOT_FOUND: 202,
  PAYMENT_ORDER_MISMATCH: 400,
  AMOUNT_MISMATCH: 202,
  CURRENCY_MISMATCH: 202,
  GATEWAY_ERROR: 202,
  DATABASE_ERROR: 202,
  NOT_CONFIGURED: 503,
};

/**
 * POST /api/consultations/payment/verify
 *
 * Receives the Razorpay Checkout success callback values. The browser's claim is
 * only a hint: the signature is checked against the order ID stored in our database,
 * the payment is fetched from Razorpay, and only a captured payment becomes paid.
 * The response is the authoritative status, never "trust the browser".
 * Uncertain outcomes answer 202 ("still verifying") so the customer never pays twice.
 */
export async function POST(request: NextRequest) {
  const guard = await guardPublicJsonPost(request, {
    bucket: "consultations_payment_verify",
    limit: 20,
    windowMs: 10 * 60 * 1000,
    maxBytes: 4096,
  });
  if (!guard.ok) return guard.response;
  const { body, headers, requestId } = guard;

  const validation = validateCheckoutVerification(body);
  if (!validation.success) {
    return NextResponse.json({ success: false, message: validation.error }, { status: 400, headers });
  }

  try {
    const result = await paymentConfirmationService.verifyCheckoutCallback(validation.data);
    if (!result.success) {
      logger.warn("Checkout verification did not complete", { requestId, code: result.error });
      return NextResponse.json(
        { success: false, code: result.error, message: result.message },
        { status: STATUS[result.error], headers }
      );
    }

    if (result.outcome !== "payment_not_completed") {
      const outcome = result.outcome;
      after(() =>
        paymentNotificationService.notifyPaymentOutcome(outcome, result.orderId, result.consultationId)
      );
    }

    const status = await paymentStatusService.getStatus({
      consultationId: validation.data.consultationId,
      reservationToken: validation.data.reservationToken,
      syncWithProvider: false,
    });
    return NextResponse.json(
      { success: true, data: status.success ? status.data : null },
      { status: 200, headers }
    );
  } catch (err) {
    logger.error("Unhandled error in checkout verification", err, { requestId });
    return NextResponse.json(
      { success: false, message: "Your payment is being verified. Please do not pay again." },
      { status: 202, headers }
    );
  }
}
