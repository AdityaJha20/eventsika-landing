import { NextRequest, NextResponse } from "next/server";
import { guardPublicJsonPost } from "@/lib/backend/http/public-json-route";
import { validateRebookRequest } from "@/lib/backend/validation/payment-verification-schema";
import { paymentStatusService, RebookResultCode } from "@/lib/backend/services/payment-status-service";

export const dynamic = "force-dynamic";

const RESPONSES: Record<RebookResultCode, { status: number; message: string }> = {
  REBOOKED: { status: 200, message: "Your consultation is confirmed for the new time." },
  NOT_FOUND: { status: 404, message: "Booking not found." },
  NOT_IN_CONFLICT: { status: 409, message: "This booking does not need a new time." },
  NOT_PAID: { status: 409, message: "No completed payment was found for this booking." },
  SLOT_UNAVAILABLE: { status: 409, message: "That time is no longer available. Please choose another." },
  DATABASE_ERROR: { status: 503, message: "Please try again in a moment." },
};

/**
 * POST /api/consultations/payment/rebook
 *
 * Paid + slot conflict: the customer picks a replacement slot. The existing payment
 * stays attached; no second payment is ever requested. Not affected by the payments
 * kill switch (it takes no new money).
 */
export async function POST(request: NextRequest) {
  const guard = await guardPublicJsonPost(request, {
    bucket: "consultations_payment_rebook",
    limit: 10,
    windowMs: 10 * 60 * 1000,
    maxBytes: 2048,
  });
  if (!guard.ok) return guard.response;
  const { body, headers } = guard;

  const validation = validateRebookRequest(body);
  if (!validation.success) {
    return NextResponse.json({ success: false, message: validation.error }, { status: 400, headers });
  }

  const code = await paymentStatusService.rebookConflict(validation.data);
  const { status, message } = RESPONSES[code];
  return NextResponse.json({ success: code === "REBOOKED", code, message }, { status, headers });
}
