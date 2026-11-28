import { NextRequest, NextResponse } from "next/server";
import { guardPublicJsonPost } from "@/lib/backend/http/public-json-route";
import { requireFinanceAdminSession } from "@/lib/backend/auth/require-admin";
import { paymentReconciliationService } from "@/lib/backend/services/payment-reconciliation-service";
import { getPaymentReadiness } from "@/lib/backend/config/env";

export const dynamic = "force-dynamic";

/** POST /api/admin/payments/reconcile — manual reconciliation run (finance administrators). */
export async function POST(request: NextRequest) {
  const guard = await guardPublicJsonPost(request, {
    bucket: "admin_payments_reconcile",
    limit: 6,
    windowMs: 10 * 60 * 1000,
    maxBytes: 256,
  });
  if (!guard.ok) return guard.response;
  const { headers, requestId } = guard;

  const auth = await requireFinanceAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status, headers });
  }
  if (!getPaymentReadiness().ready) {
    return NextResponse.json({ success: false, message: "Razorpay is not configured." }, { status: 503, headers });
  }
  const report = await paymentReconciliationService.run({ actor: { type: "admin", id: auth.user.id }, requestId });
  return NextResponse.json({ success: true, data: report }, { status: 200, headers });
}
