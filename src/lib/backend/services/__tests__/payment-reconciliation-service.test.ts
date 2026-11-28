import { describe, it, expect, vi, beforeEach } from "vitest";
import { PaymentReconciliationService } from "../payment-reconciliation-service";
import { RazorpayWebhookProcessor } from "../razorpay-webhook-processor";
import { WebhookEventRecord } from "../../types/payment-and-consultation";
import {
  aTransaction,
  anOrder,
  CONSULTATION_ID,
  mockLedger,
  mockOrderRepo,
  mockTransactionRepo,
  mockWebhookRepo,
  ORDER_ID,
} from "./payment-test-doubles";

const event = (o: Partial<WebhookEventRecord> = {}): WebhookEventRecord => ({
  id: "evt-row-1",
  provider: "razorpay",
  eventId: "evt_1",
  eventType: "payment.captured",
  payload: {
    event: "payment.captured",
    created_at: 1790000200,
    payment: { id: "pay_TestPayment01", orderId: "order_TestOrder0001", amountInPaise: 299900, currency: "INR", status: "captured", method: "upi", bankReference: null, errorCode: null, errorDescription: null, createdAt: null },
  },
  signature: "sig",
  status: "received",
  processingError: null,
  processedAt: null,
  attempts: 1,
  lockedUntil: "2026-10-01T09:00:00.000Z",
  createdAt: "2026-10-01T09:00:00.000Z",
  ...o,
});

describe("RazorpayWebhookProcessor", () => {
  it("applies a stored payment event and reports the outcome", async () => {
    const confirmation = { applyProviderPayment: vi.fn().mockResolvedValue({ success: true, outcome: "confirmed", orderId: ORDER_ID, consultationId: CONSULTATION_ID }) };
    const processor = new RazorpayWebhookProcessor({ confirmation, refunds: { applyProviderRefund: vi.fn() }, ledger: mockLedger() });
    const result = await processor.process(event());
    expect(result).toEqual({ status: "processed", paymentOutcome: { outcome: "confirmed", orderId: ORDER_ID, consultationId: CONSULTATION_ID } });
    expect(confirmation.applyProviderPayment.mock.calls[0][1]).toBe(new Date(1790000200 * 1000).toISOString());
  });

  it("marks transient failures 'failed' (retryable) and business failures 'rejected'", async () => {
    const confirmation = { applyProviderPayment: vi.fn() };
    const processor = new RazorpayWebhookProcessor({ confirmation, refunds: { applyProviderRefund: vi.fn() }, ledger: mockLedger() });
    confirmation.applyProviderPayment.mockResolvedValueOnce({ success: false, error: "DATABASE_ERROR", message: "x" });
    expect((await processor.process(event())).status).toBe("failed");
    confirmation.applyProviderPayment.mockResolvedValueOnce({ success: false, error: "AMOUNT_MISMATCH", message: "x" });
    expect((await processor.process(event())).status).toBe("rejected");
    confirmation.applyProviderPayment.mockRejectedValueOnce(new Error("crash"));
    expect((await processor.process(event())).status).toBe("failed");
  });

  it("keeps untracked refunds visible as issues", async () => {
    const ledger = mockLedger();
    const processor = new RazorpayWebhookProcessor({ confirmation: { applyProviderPayment: vi.fn() }, refunds: { applyProviderRefund: vi.fn().mockResolvedValue(null) }, ledger });
    const result = await processor.process(
      event({ eventType: "refund.processed", payload: { event: "refund.processed", refund: { id: "rfnd_X", paymentId: "pay_TestPayment01", amountInPaise: 500, status: "processed" } } })
    );
    expect(result.status).toBe("processed");
    expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "untracked_refund", gatewayReference: "rfnd_X" }));
  });
});

describe("PaymentReconciliationService", () => {
  const now = new Date("2026-10-02T10:00:00.000Z");
  let webhooks: ReturnType<typeof mockWebhookRepo>;
  let orders: ReturnType<typeof mockOrderRepo>;
  let transactions: ReturnType<typeof mockTransactionRepo>;
  let ledger: ReturnType<typeof mockLedger>;
  let confirmation: { syncOrderWithProvider: ReturnType<typeof vi.fn> };
  let processor: { process: ReturnType<typeof vi.fn> };
  let refunds: { reconcileOpenRefunds: ReturnType<typeof vi.fn> };
  let notifications: { retryPending: ReturnType<typeof vi.fn>; notifyPaymentOutcome: ReturnType<typeof vi.fn> };
  let service: PaymentReconciliationService;

  beforeEach(() => {
    webhooks = mockWebhookRepo();
    orders = mockOrderRepo();
    transactions = mockTransactionRepo([]);
    ledger = mockLedger();
    confirmation = { syncOrderWithProvider: vi.fn().mockResolvedValue(null) };
    processor = { process: vi.fn().mockResolvedValue({ status: "processed" }) };
    refunds = { reconcileOpenRefunds: vi.fn().mockResolvedValue({ resubmitted: 0, updated: 0, errors: 0 }) };
    notifications = { retryPending: vi.fn().mockResolvedValue({ sent: 0, failed: 0, skipped: 0 }), notifyPaymentOutcome: vi.fn() };
    // Plain vi.fn doubles; the Pick<> types are enforced on the production call sites.
    service = new PaymentReconciliationService({ orders, transactions, webhooks, ledger, confirmation, processor, refunds, notifications } as unknown as ConstructorParameters<typeof PaymentReconciliationService>[0]);
  });

  it("re-processes webhook events stuck after a crash, under a fresh lease", async () => {
    vi.mocked(webhooks.listRetryableEvents).mockResolvedValueOnce([event()]);
    vi.mocked(webhooks.claimWebhookEvent).mockResolvedValueOnce(event({ attempts: 2 }));
    processor.process.mockResolvedValueOnce({ status: "processed", paymentOutcome: { outcome: "confirmed", orderId: ORDER_ID, consultationId: CONSULTATION_ID } });

    const report = await service.run({ now });
    expect(webhooks.claimWebhookEvent).toHaveBeenCalledWith("evt-row-1", 60, 10);
    expect(webhooks.updateWebhookEventStatus).toHaveBeenCalledWith("evt-row-1", "processed", expect.anything());
    expect(notifications.notifyPaymentOutcome).toHaveBeenCalledWith("confirmed", ORDER_ID, CONSULTATION_ID);
    expect(report.webhooks).toEqual({ retried: 1, processed: 1, failed: 0 });
  });

  it("skips events another worker has leased in the meantime", async () => {
    vi.mocked(webhooks.listRetryableEvents).mockResolvedValueOnce([event()]);
    vi.mocked(webhooks.claimWebhookEvent).mockResolvedValueOnce(null);
    await service.run({ now });
    expect(processor.process).not.toHaveBeenCalled();
  });

  it("recovers a missed capture (captured at Razorpay, pending here) and notifies", async () => {
    vi.mocked(orders.listOpenOrders).mockResolvedValueOnce([anOrder({ status: "attempted" })]);
    confirmation.syncOrderWithProvider.mockResolvedValueOnce({ success: true, outcome: "confirmed", orderId: ORDER_ID, consultationId: CONSULTATION_ID });
    const report = await service.run({ now });
    expect(report.orders).toEqual({ checked: 1, changed: 1, errors: 0 });
    expect(notifications.notifyPaymentOutcome).toHaveBeenCalledWith("confirmed", ORDER_ID, CONSULTATION_ID);
  });

  it("flags an order whose creation outcome is unknown and absent at Razorpay", async () => {
    vi.mocked(orders.listOpenOrders).mockResolvedValueOnce([anOrder({ status: "created", gatewayOrderId: null })]);
    await service.run({ now });
    expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "order_creation_unknown" }));
  });

  it("flags payments authorized but not captured for too long", async () => {
    vi.mocked(orders.listOpenOrders).mockResolvedValueOnce([anOrder({ status: "attempted" })]);
    vi.mocked(transactions.getTransactionsByOrderId).mockResolvedValueOnce([aTransaction({ status: "pending", createdAt: "2026-10-01T10:00:00.000Z" })]);
    const report = await service.run({ now });
    expect(report.authorizedNotCaptured).toBe(1);
    expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "authorized_not_captured" }));
  });

  it("isolates a failing order (records reconciliation_error) and continues", async () => {
    vi.mocked(orders.listOpenOrders).mockResolvedValueOnce([anOrder({ id: "o-bad", status: "attempted" }), anOrder({ id: "o-good", status: "attempted" })]);
    confirmation.syncOrderWithProvider.mockRejectedValueOnce(new Error("razorpay 500")).mockResolvedValueOnce(null);
    const report = await service.run({ now });
    expect(report.orders).toMatchObject({ checked: 2, errors: 1 });
    expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "reconciliation_error", paymentOrderId: "o-bad" }));
    expect(refunds.reconcileOpenRefunds).toHaveBeenCalled();
    expect(notifications.retryPending).toHaveBeenCalled();
  });

  it("only looks at orders in the safe age window", async () => {
    await service.run({ now });
    const [provider, before, after] = vi.mocked(orders.listOpenOrders).mock.calls[0];
    expect(provider).toBe("razorpay");
    expect(new Date(before).getTime()).toBe(now.getTime() - 5 * 60 * 1000);
    expect(new Date(after).getTime()).toBe(now.getTime() - 7 * 24 * 3600 * 1000);
  });

  it("is safe to run twice and audits every run", async () => {
    await service.run({ now, actor: { type: "admin", id: "admin-1" }, requestId: "req-1" });
    await service.run({ now });
    expect(ledger.appendAudit).toHaveBeenCalledTimes(2);
    expect(vi.mocked(ledger.appendAudit).mock.calls[0][0]).toMatchObject({ action: "reconciliation_run", actorType: "admin", actorId: "admin-1" });
  });
});
