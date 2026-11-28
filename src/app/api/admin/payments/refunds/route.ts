import { NextRequest, NextResponse } from "next/server";
import { guardPublicJsonPost } from "@/lib/backend/http/public-json-route";
import { requireFinanceAdminSession } from "@/lib/backend/auth/require-admin";
import { paymentRefundService, RefundReason, RefundRequestError } from "@/lib/backend/services/payment-refund-service";
import { logger } from "@/lib/backend/logger/logger";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASONS: RefundReason[] = [
  "customer_cancellation",
  "eventsika_cancellation_alternative_rejected",
  "duplicate_payment",
  "goodwill",
];
const STATUS: Record<RefundRequestError, number> = {
  NOT_FOUND: 404,
  NOT_ELIGIBLE: 422,
  ORDER_NOT_PAID: 409,
  TRANSACTION_NOT_REFUNDABLE: 409,
  REFUND_EXCEEDS_BALANCE: 409,
  MANUAL_REVIEW: 202,
  DATABASE_ERROR: 503,
};

/**
 * POST /api/admin/payments/refunds  (finance administrators only)
 * Body: { paymentOrderId, reason, note, clientRequestKey, amountInPaise?, paymentTransactionId? }
 * The amount defaults to the remaining refundable balance; the server re-checks
 * eligibility and balance. There is no endpoint that marks anything as paid.
 */
export async function POST(request: NextRequest) {
  const guard = await guardPublicJsonPost(request, {
    bucket: "admin_payments_refund",
    limit: 20,
    windowMs: 10 * 60 * 1000,
    maxBytes: 4096,
  });
  if (!guard.ok) return guard.response;
  const { body, headers, requestId } = guard;

  const auth = await requireFinanceAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status, headers });
  }

  const { paymentOrderId, reason, note, clientRequestKey, amountInPaise, paymentTransactionId } = body;
  if (typeof paymentOrderId !== "string" || !UUID.test(paymentOrderId)) {
    return NextResponse.json({ success: false, message: "Invalid payment order." }, { status: 400, headers });
  }
  if (typeof reason !== "string" || !REASONS.includes(reason as RefundReason)) {
    return NextResponse.json({ success: false, message: "Invalid refund reason." }, { status: 400, headers });
  }
  if (typeof note !== "string" || note.trim().length < 5 || note.length > 300) {
    return NextResponse.json({ success: false, message: "A note of 5-300 characters is required." }, { status: 400, headers });
  }
  if (typeof clientRequestKey !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(clientRequestKey)) {
    return NextResponse.json({ success: false, message: "Invalid request key." }, { status: 400, headers });
  }
  if (
    amountInPaise !== undefined &&
    amountInPaise !== null &&
    (typeof amountInPaise !== "number" || !Number.isSafeInteger(amountInPaise) || amountInPaise <= 0)
  ) {
    return NextResponse.json({ success: false, message: "Amount must be positive whole paise." }, { status: 400, headers });
  }
  if (
    paymentTransactionId !== undefined &&
    paymentTransactionId !== null &&
    (typeof paymentTransactionId !== "string" || !UUID.test(paymentTransactionId))
  ) {
    return NextResponse.json({ success: false, message: "Invalid payment transaction." }, { status: 400, headers });
  }

  try {
    const result = await paymentRefundService.requestRefund({
      paymentOrderId,
      paymentTransactionId: typeof paymentTransactionId === "string" ? paymentTransactionId : null,
      amountInPaise: typeof amountInPaise === "number" ? amountInPaise : null,
      reason: reason as RefundReason,
      note: note.trim(),
      actorId: auth.user.id,
      requestId,
      clientRequestKey,
    });
    if (!result.success) {
      return NextResponse.json(
        { success: false, code: result.error, message: result.message },
        { status: STATUS[result.error], headers }
      );
    }
    logger.info("Refund requested by finance admin", { requestId, refundId: result.refund.id, state: result.providerState });
    return NextResponse.json(
      { success: true, data: { refundId: result.refund.id, status: result.refund.status, providerState: result.providerState } },
      { status: 200, headers }
    );
  } catch (err) {
    logger.error("Refund request failed", err, { requestId });
    return NextResponse.json({ success: false, message: "Refund could not be processed." }, { status: 500, headers });
  }
}
