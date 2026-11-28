import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as refundPOST } from "../refunds/route";
import { POST as resolvePOST } from "../issues/resolve/route";
import { POST as reconcilePOST } from "../reconcile/route";
import { POST as internalReconcilePOST } from "../../../internal/payments/reconcile/route";
import * as rateLimitModule from "@/lib/rate-limit";
import * as adminAuth from "@/lib/backend/auth/require-admin";
import { paymentRefundService } from "@/lib/backend/services/payment-refund-service";
import { paymentReconciliationService } from "@/lib/backend/services/payment-reconciliation-service";
import { SupabasePaymentLedgerRepository } from "@/lib/backend/repositories/payment-ledger-repository";
import { requireFinanceAdminSession } from "@/lib/backend/auth/require-admin";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const refundBody = {
  paymentOrderId: ORDER_ID,
  reason: "customer_cancellation",
  note: "Customer cancelled 3 days ahead",
  clientRequestKey: "clientkey0123456789",
};

function req(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "198.51.100.50", ...headers },
    body: JSON.stringify(body),
  });
}

const financeAdmin = { authorized: true as const, user: { id: "admin-1", email: "ops@example.com", role: "admin" as const } };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.spyOn(rateLimitModule, "checkRateLimit").mockResolvedValue({ isAllowed: true, remaining: 10, resetTime: Date.now() + 60000, retryAfterSeconds: 0 });
});

describe("POST /api/admin/payments/refunds", () => {
  it("denies ordinary admins without financial authority (403) and touches nothing", async () => {
    vi.spyOn(adminAuth, "requireFinanceAdminSession").mockResolvedValueOnce({ authorized: false, status: 403, error: "Financial administrator privileges required." });
    const spy = vi.spyOn(paymentRefundService, "requestRefund");
    const res = await refundPOST(req("/api/admin/payments/refunds", refundBody));
    expect(res.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it("denies unauthenticated callers (401)", async () => {
    vi.spyOn(adminAuth, "requireFinanceAdminSession").mockResolvedValueOnce({ authorized: false, status: 401, error: "Authentication required." });
    expect((await refundPOST(req("/api/admin/payments/refunds", refundBody))).status).toBe(401);
  });

  it("passes actor, request id and idempotency key to the refund service", async () => {
    vi.spyOn(adminAuth, "requireFinanceAdminSession").mockResolvedValueOnce(financeAdmin);
    const spy = vi.spyOn(paymentRefundService, "requestRefund").mockResolvedValueOnce({
      success: true,
      refund: { id: "r1", status: "initiated" } as never,
      providerState: "initiated",
    });
    const res = await refundPOST(req("/api/admin/payments/refunds", { ...refundBody, amountInPaise: 100000 }));
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", clientRequestKey: refundBody.clientRequestKey, amountInPaise: 100000, requestId: expect.any(String) })
    );
  });

  it.each([
    ["missing note", { note: "" }],
    ["unknown reason", { reason: "mark_as_paid" }],
    ["fractional amount", { amountInPaise: 10.5 }],
    ["negative amount", { amountInPaise: -1 }],
    ["bad order id", { paymentOrderId: "x" }],
    ["bad request key", { clientRequestKey: "short" }],
  ])("rejects %s with 400", async (_l, override) => {
    vi.spyOn(adminAuth, "requireFinanceAdminSession").mockResolvedValueOnce(financeAdmin);
    const spy = vi.spyOn(paymentRefundService, "requestRefund");
    expect((await refundPOST(req("/api/admin/payments/refunds", { ...refundBody, ...override }))).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("maps over-refund and ineligibility to 409 / 422", async () => {
    vi.spyOn(adminAuth, "requireFinanceAdminSession").mockResolvedValue(financeAdmin);
    vi.spyOn(paymentRefundService, "requestRefund")
      .mockResolvedValueOnce({ success: false, error: "REFUND_EXCEEDS_BALANCE", message: "x" })
      .mockResolvedValueOnce({ success: false, error: "NOT_ELIGIBLE", message: "x" });
    expect((await refundPOST(req("/api/admin/payments/refunds", refundBody))).status).toBe(409);
    expect((await refundPOST(req("/api/admin/payments/refunds", refundBody))).status).toBe(422);
  });

  it("blocks cross-origin submissions before authentication", async () => {
    const auth = vi.spyOn(adminAuth, "requireFinanceAdminSession");
    const res = await refundPOST(req("/api/admin/payments/refunds", refundBody, { origin: "https://evil.example", "sec-fetch-site": "cross-site", host: "localhost:3000" }));
    expect(res.status).toBe(403);
    expect(auth).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/payments/issues/resolve", () => {
  it("requires a note and writes an audit row with the actor", async () => {
    vi.spyOn(adminAuth, "requireFinanceAdminSession").mockResolvedValue(financeAdmin);
    vi.spyOn(SupabasePaymentLedgerRepository.prototype, "resolveIssue").mockResolvedValueOnce({ id: "i1", kind: "slot_conflict", paymentOrderId: ORDER_ID } as never);
    const audit = vi.spyOn(SupabasePaymentLedgerRepository.prototype, "appendAudit").mockResolvedValueOnce(undefined);

    expect((await resolvePOST(req("/api/admin/payments/issues/resolve", { issueId: "99999999-9999-4999-8999-999999999999", note: "" }))).status).toBe(400);
    const res = await resolvePOST(req("/api/admin/payments/issues/resolve", { issueId: "99999999-9999-4999-8999-999999999999", note: "Customer rebooked by phone" }));
    expect(res.status).toBe(200);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actorType: "admin", actorId: "admin-1", action: "payment_issue_resolved" }));
  });
});

describe("Reconciliation triggers", () => {
  it("admin trigger requires financial authority", async () => {
    vi.spyOn(adminAuth, "requireFinanceAdminSession").mockResolvedValueOnce({ authorized: false, status: 403, error: "no" });
    const run = vi.spyOn(paymentReconciliationService, "run");
    expect((await reconcilePOST(req("/api/admin/payments/reconcile", {}))).status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  it("internal trigger is disabled (404) without a configured secret", async () => {
    vi.stubEnv("PAYMENT_RECONCILIATION_SECRET", "");
    const res = await internalReconcilePOST(new NextRequest("http://localhost:3000/api/internal/payments/reconcile", { method: "POST" }));
    expect(res.status).toBe(404);
  });

  it("internal trigger rejects a wrong bearer secret and accepts the right one", async () => {
    const secret = "s".repeat(40);
    vi.stubEnv("PAYMENT_RECONCILIATION_SECRET", secret);
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_UnitTestKey000");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "unit-test-key-secret");
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "unit-test-webhook-secret");
    vi.stubEnv("RAZORPAY_MODE", "test");
    const run = vi.spyOn(paymentReconciliationService, "run").mockResolvedValue({} as never);

    const wrong = await internalReconcilePOST(
      new NextRequest("http://localhost:3000/api/internal/payments/reconcile", { method: "POST", headers: { authorization: "Bearer nope" } })
    );
    expect(wrong.status).toBe(401);
    expect(run).not.toHaveBeenCalled();

    const ok = await internalReconcilePOST(
      new NextRequest("http://localhost:3000/api/internal/payments/reconcile", { method: "POST", headers: { authorization: `Bearer ${secret}` } })
    );
    expect(ok.status).toBe(200);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ actor: { type: "system", id: "scheduler" } }));
  });
});

describe("requireFinanceAdminSession", () => {
  const client = (appMetadata: Record<string, unknown> | null) => ({
    auth: {
      getUser: async () => ({
        data: { user: appMetadata ? ({ id: "u1", email: "a@example.com", app_metadata: appMetadata } as never) : null },
        error: null,
      }),
    },
  });

  it("rejects an ordinary admin", async () => {
    expect(await requireFinanceAdminSession(client({ role: "admin" }))).toMatchObject({ authorized: false, status: 403 });
  });

  it("rejects a finance flag without the admin role", async () => {
    expect(await requireFinanceAdminSession(client({ finance_admin: true }))).toMatchObject({ authorized: false, status: 403 });
  });

  it("rejects a truthy-but-not-true finance flag", async () => {
    expect(await requireFinanceAdminSession(client({ role: "admin", finance_admin: "true" }))).toMatchObject({ authorized: false });
  });

  it("accepts admin + finance_admin === true", async () => {
    expect(await requireFinanceAdminSession(client({ role: "admin", finance_admin: true }))).toMatchObject({ authorized: true });
  });

  it("rejects anonymous callers", async () => {
    expect(await requireFinanceAdminSession(client(null))).toMatchObject({ authorized: false, status: 401 });
  });
});
