import { NextRequest, NextResponse } from "next/server";
import { guardPublicJsonPost } from "@/lib/backend/http/public-json-route";
import { validateStatusRequest } from "@/lib/backend/validation/payment-verification-schema";
import { paymentStatusService } from "@/lib/backend/services/payment-status-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/consultations/payment/status
 *
 * Authoritative customer status for one consultation (consultationId + reservation
 * token in the body, never in the URL). Rate limited for bounded client polling;
 * an unresolved Razorpay order is cross-checked against the Razorpay API.
 */
export async function POST(request: NextRequest) {
  const guard = await guardPublicJsonPost(request, {
    bucket: "consultations_payment_status",
    limit: 60,
    windowMs: 10 * 60 * 1000,
    maxBytes: 2048,
  });
  if (!guard.ok) return guard.response;
  const { body, headers } = guard;

  const validation = validateStatusRequest(body);
  if (!validation.success) {
    return NextResponse.json({ success: false, message: validation.error }, { status: 400, headers });
  }

  const result = await paymentStatusService.getStatus({ ...validation.data, syncWithProvider: true });
  if (!result.success) {
    return result.error === "NOT_FOUND"
      ? NextResponse.json({ success: false, message: "Booking not found." }, { status: 404, headers })
      : NextResponse.json(
          { success: false, message: "Status temporarily unavailable. Your payment is safe; please retry shortly." },
          { status: 503, headers }
        );
  }
  return NextResponse.json({ success: true, data: result.data }, { status: 200, headers });
}
