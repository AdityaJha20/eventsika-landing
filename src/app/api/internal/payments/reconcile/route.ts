import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPaymentReadiness, getServerConfig } from "@/lib/backend/config/env";
import { paymentReconciliationService } from "@/lib/backend/services/payment-reconciliation-service";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";
import { logger } from "@/lib/backend/logger/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/internal/payments/reconcile
 * For a scheduler (Hostinger cron / external pinger):
 *   Authorization: Bearer <PAYMENT_RECONCILIATION_SECRET>   (>= 32 characters)
 * Disabled (404) when the secret is unset. Idempotent: running it twice is harmless.
 */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const headers = { "X-Request-Id": requestId, "Cache-Control": "no-store" };
  const secret = getServerConfig().payments.reconciliationSecret;
  if (!secret) return NextResponse.json({ error: "Not found." }, { status: 404, headers });

  const supplied = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = crypto.createHash("sha256").update(supplied).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  if (!supplied || !crypto.timingSafeEqual(a, b)) {
    logger.warn("Rejected reconciliation trigger with invalid credentials", { requestId });
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  }
  if (!getPaymentReadiness().ready) {
    return NextResponse.json({ error: "Razorpay is not configured." }, { status: 503, headers });
  }
  const report = await paymentReconciliationService.run({ actor: { type: "system", id: "scheduler" }, requestId });
  return NextResponse.json({ success: true, data: report }, { status: 200, headers });
}
