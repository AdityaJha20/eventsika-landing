import { NextRequest, NextResponse } from "next/server";
import { guardPublicJsonPost } from "@/lib/backend/http/public-json-route";
import { requireFinanceAdminSession } from "@/lib/backend/auth/require-admin";
import { SupabasePaymentLedgerRepository } from "@/lib/backend/repositories/payment-ledger-repository";
import { logger } from "@/lib/backend/logger/logger";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/payments/issues/resolve  (finance administrators only)
 * Closes a payment issue with a mandatory note. Changes no financial record; the
 * resolution and actor are kept on the issue and in the append-only audit log.
 */
export async function POST(request: NextRequest) {
  const guard = await guardPublicJsonPost(request, {
    bucket: "admin_payments_issue",
    limit: 60,
    windowMs: 10 * 60 * 1000,
    maxBytes: 2048,
  });
  if (!guard.ok) return guard.response;
  const { body, headers, requestId } = guard;

  const auth = await requireFinanceAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, message: auth.error }, { status: auth.status, headers });
  }
  const { issueId, note } = body;
  if (typeof issueId !== "string" || !UUID.test(issueId)) {
    return NextResponse.json({ success: false, message: "Invalid issue." }, { status: 400, headers });
  }
  if (typeof note !== "string" || note.trim().length < 5 || note.length > 500) {
    return NextResponse.json({ success: false, message: "A note of 5-500 characters is required." }, { status: 400, headers });
  }

  const ledger = new SupabasePaymentLedgerRepository();
  try {
    const issue = await ledger.resolveIssue(issueId, auth.user.id, note.trim());
    if (!issue) {
      return NextResponse.json({ success: false, message: "Issue not found or already resolved." }, { status: 404, headers });
    }
    await ledger.appendAudit({
      actorType: "admin",
      actorId: auth.user.id,
      action: "payment_issue_resolved",
      entityType: "issue",
      entityId: issue.id,
      oldState: "open",
      newState: "resolved",
      reason: note.trim(),
      requestId,
      metadata: { kind: issue.kind, payment_order_id: issue.paymentOrderId },
    });
    return NextResponse.json({ success: true }, { status: 200, headers });
  } catch (err) {
    logger.error("Resolving payment issue failed", err, { requestId });
    return NextResponse.json({ success: false, message: "Could not resolve the issue." }, { status: 500, headers });
  }
}
