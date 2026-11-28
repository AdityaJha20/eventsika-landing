import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PaymentConfirmationService,
  isTransientConfirmationError,
  normalizePaymentMethod,
  NormalizedPaymentEvent,
} from "../payment-confirmation-service";
import { IPaymentOrderRepository } from "../../repositories/payment-order-repository.interface";
import { ApplyPaymentEventResult, IPaymentLedgerRepository } from "../../repositories/payment-ledger-repository";
import { GatewayError, IOrderPaymentGateway, ProviderPayment } from "../../integrations/payment-gateway.interface";
import { computeRazorpayCheckoutSignature } from "../../security/razorpay-signature";
import { NormalizedCashfreePaymentWebhook } from "../../domain/webhook-types";
import { PaymentOrderRecord } from "../../types/payment-and-consultation";

const KEY_SECRET = "unit-test-key-secret";
const WEBHOOK_SECRET = "unit-test-webhook-secret";
const TOKEN = "a".repeat(64);

const order: PaymentOrderRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  consultationId: "22222222-2222-4222-8222-222222222222",
  provider: "razorpay",
  gatewayOrderId: "order_TestOrder0001",
  receipt: "rcpt_22222222222242228222222222222222",
  amountInPaise: 299900,
  currency: "INR",
  status: "created",
  expiresAt: null,
  paidAt: null,
  reservationToken: TOKEN,
  requestId: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

const payment = (overrides: Partial<ProviderPayment> = {}): ProviderPayment => ({
  id: "pay_TestPayment01",
  orderId: "order_TestOrder0001",
  amountInPaise: 299900,
  currency: "INR",
  status: "captured",
  method: "upi",
  bankReference: "123456789012",
  errorCode: null,
  errorDescription: null,
  createdAt: "2026-10-01T10:02:00.000Z",
  ...overrides,
});

const applied = (outcome: ApplyPaymentEventResult["outcome"]): ApplyPaymentEventResult => ({
  outcome,
  paymentOrderId: order.id,
  consultationId: order.consultationId,
  transactionId: "33333333-3333-4333-8333-333333333333",
  orderStatus: outcome === "confirmed" ? "paid" : "attempted",
});

describe("PaymentConfirmationService (provider-neutral, RPC-backed)", () => {
  let orders: IPaymentOrderRepository;
  let ledger: IPaymentLedgerRepository;
  let gateway: IOrderPaymentGateway;
  let service: PaymentConfirmationService;

  const event = (overrides: Partial<NormalizedPaymentEvent> = {}): NormalizedPaymentEvent => ({
    provider: "razorpay",
    gatewayOrderId: "order_TestOrder0001",
    gatewayPaymentId: "pay_TestPayment01",
    status: "captured",
    amountInPaise: 299900,
    currency: "INR",
    paymentMethod: "upi",
    ...overrides,
  });

  beforeEach(() => {
    orders = {
      createOrder: vi.fn(),
      getOrderById: vi.fn().mockResolvedValue(order),
      getOrderByGatewayId: vi.fn(),
      getOrderByProviderGatewayId: vi.fn().mockResolvedValue(order),
      getOrderByReceipt: vi.fn().mockResolvedValue(order),
      attachGatewayOrderId: vi.fn().mockImplementation(async (id: string, gid: string) => ({ ...order, id, gatewayOrderId: gid })),
      updateOrderStatus: vi.fn(),
      getLatestOrderByConsultationId: vi.fn().mockResolvedValue(order),
      listOpenOrders: vi.fn(),
    };
    ledger = {
      applyPaymentEvent: vi.fn().mockResolvedValue(applied("confirmed")),
      createRefundIntent: vi.fn(),
      rebookConflictedConsultation: vi.fn(),
      claimNotification: vi.fn(),
      completeNotification: vi.fn(),
      listRetryableNotifications: vi.fn(),
      recordIssue: vi.fn().mockResolvedValue(undefined),
      resolveIssue: vi.fn(),
      listOpenIssues: vi.fn(),
      appendAudit: vi.fn(),
    };
    gateway = {
      provider: "razorpay",
      createOrder: vi.fn(),
      fetchOrder: vi.fn(),
      findOrderByReceipt: vi.fn(),
      fetchOrderPayments: vi.fn().mockResolvedValue([]),
      fetchPayment: vi.fn().mockResolvedValue(payment()),
      createRefund: vi.fn(),
      fetchRefund: vi.fn(),
      fetchPaymentRefunds: vi.fn(),
    };
    service = new PaymentConfirmationService({
      paymentOrderRepo: orders,
      ledger,
      gateway,
      keySecretResolver: () => KEY_SECRET,
    });
  });

  describe("applyPaymentEvent", () => {
    it("resolves the order by provider-scoped id and applies the event atomically via the ledger RPC", async () => {
      const result = await service.applyPaymentEvent(event({ paymentMethod: "credit_card", eventTime: "2026-10-01T10:02:00.000Z" }));

      expect(orders.getOrderByProviderGatewayId).toHaveBeenCalledWith("razorpay", "order_TestOrder0001");
      expect(ledger.applyPaymentEvent).toHaveBeenCalledWith({
        paymentOrderId: order.id,
        gatewayPaymentId: "pay_TestPayment01",
        status: "captured",
        amountInPaise: 299900,
        currency: "INR",
        paymentMethod: "card",
        bankReference: null,
        errorCode: null,
        errorDescription: null,
        eventTime: "2026-10-01T10:02:00.000Z",
      });
      expect(result).toEqual({
        success: true,
        outcome: "confirmed",
        orderId: order.id,
        consultationId: order.consultationId,
        transactionId: "33333333-3333-4333-8333-333333333333",
      });
    });

    it.each(["slot_conflict", "already_confirmed", "duplicate_payment", "payment_failed", "payment_pending", "user_dropped", "paid_inactive_consultation"] as const)(
      "passes the '%s' ledger outcome through unchanged",
      async (outcome) => {
        vi.mocked(ledger.applyPaymentEvent).mockResolvedValueOnce(applied(outcome));
        const result = await service.applyPaymentEvent(event());
        expect(result.success && result.outcome).toBe(outcome);
      }
    );

    it("maps ledger amount/currency mismatches to terminal failures (issue recorded inside the RPC)", async () => {
      vi.mocked(ledger.applyPaymentEvent).mockResolvedValueOnce(applied("amount_mismatch"));
      const amount = await service.applyPaymentEvent(event({ amountInPaise: 100 }));
      expect(amount).toMatchObject({ success: false, error: "AMOUNT_MISMATCH" });

      vi.mocked(ledger.applyPaymentEvent).mockResolvedValueOnce(applied("currency_mismatch"));
      const currency = await service.applyPaymentEvent(event({ currency: "USD" }));
      expect(currency).toMatchObject({ success: false, error: "CURRENCY_MISMATCH" });
      expect(isTransientConfirmationError("AMOUNT_MISMATCH")).toBe(false);
    });

    it("records an unknown_gateway_order issue and applies nothing when the order is unknown", async () => {
      vi.mocked(orders.getOrderByProviderGatewayId).mockResolvedValueOnce(null);
      vi.mocked(gateway.fetchOrder).mockResolvedValueOnce(null);
      const result = await service.applyPaymentEvent(event());
      expect(result).toMatchObject({ success: false, error: "ORDER_NOT_FOUND" });
      expect(ledger.applyPaymentEvent).not.toHaveBeenCalled();
      expect(ledger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "unknown_gateway_order", provider: "razorpay" }));
    });

    it("recovers an order whose creation response was lost by matching the Razorpay receipt (link set once)", async () => {
      vi.mocked(orders.getOrderByProviderGatewayId).mockResolvedValueOnce(null);
      vi.mocked(gateway.fetchOrder).mockResolvedValueOnce({ id: "order_TestOrder0001", amountInPaise: 299900, currency: "INR", receipt: order.receipt, status: "paid" });
      vi.mocked(orders.getOrderByReceipt).mockResolvedValueOnce({ ...order, gatewayOrderId: null });

      const result = await service.applyPaymentEvent(event());
      expect(orders.attachGatewayOrderId).toHaveBeenCalledWith(order.id, "order_TestOrder0001");
      expect(result.success).toBe(true);
    });

    it("never re-links a local order that is already linked to a different Razorpay order", async () => {
      vi.mocked(orders.getOrderByProviderGatewayId).mockResolvedValueOnce(null);
      vi.mocked(gateway.fetchOrder).mockResolvedValueOnce({ id: "order_Other000001", amountInPaise: 299900, currency: "INR", receipt: order.receipt, status: "paid" });
      vi.mocked(orders.getOrderByReceipt).mockResolvedValueOnce({ ...order, gatewayOrderId: "order_TestOrder0001" });

      const result = await service.applyPaymentEvent(event({ gatewayOrderId: "order_Other000001" }));
      expect(result).toMatchObject({ success: false, error: "ORDER_NOT_FOUND" });
      expect(orders.attachGatewayOrderId).not.toHaveBeenCalled();
    });

    it("returns a transient DATABASE_ERROR when the ledger RPC fails (provider retries)", async () => {
      vi.mocked(ledger.applyPaymentEvent).mockRejectedValueOnce(new Error("connection reset"));
      const result = await service.applyPaymentEvent(event());
      expect(result).toMatchObject({ success: false, error: "DATABASE_ERROR" });
      expect(isTransientConfirmationError("DATABASE_ERROR")).toBe(true);
    });

    it("truncates provider error text before persisting", async () => {
      await service.applyPaymentEvent(event({ status: "failed", errorCode: "X".repeat(80), errorDescription: "y".repeat(900) }));
      const params = vi.mocked(ledger.applyPaymentEvent).mock.calls[0][0];
      expect(params.errorCode).toHaveLength(50);
      expect(params.errorDescription).toHaveLength(500);
    });
  });

  describe("applyProviderPayment (status mapping)", () => {
    it.each([
      ["captured", "captured"],
      ["refunded", "captured"],
      ["authorized", "authorized"],
      ["failed", "failed"],
    ] as const)("maps Razorpay '%s' to ledger '%s'", async (providerStatus, ledgerStatus) => {
      await service.applyProviderPayment(payment({ status: providerStatus }));
      expect(vi.mocked(ledger.applyPaymentEvent).mock.calls[0][0].status).toBe(ledgerStatus);
    });

    it("does nothing for a payment that has only been created", async () => {
      expect(await service.applyProviderPayment(payment({ status: "created" }))).toBeNull();
      expect(ledger.applyPaymentEvent).not.toHaveBeenCalled();
    });
  });

  describe("syncOrderWithProvider (reconciliation / status recovery)", () => {
    it("applies failed attempts before the capture so the final result is the capture", async () => {
      vi.mocked(gateway.fetchOrderPayments).mockResolvedValueOnce([
        payment({ id: "pay_Captured0001", status: "captured" }),
        payment({ id: "pay_Failed00001", status: "failed" }),
      ]);
      vi.mocked(ledger.applyPaymentEvent)
        .mockResolvedValueOnce(applied("payment_failed"))
        .mockResolvedValueOnce(applied("confirmed"));

      const result = await service.syncOrderWithProvider(order);
      const appliedIds = vi.mocked(ledger.applyPaymentEvent).mock.calls.map((c) => c[0].gatewayPaymentId);
      expect(appliedIds).toEqual(["pay_Failed00001", "pay_Captured0001"]);
      expect(result).toMatchObject({ success: true, outcome: "confirmed" });
    });

    it("ignores payments that belong to a different order", async () => {
      vi.mocked(gateway.fetchOrderPayments).mockResolvedValueOnce([payment({ orderId: "order_Other000001" })]);
      expect(await service.syncOrderWithProvider(order)).toBeNull();
      expect(ledger.applyPaymentEvent).not.toHaveBeenCalled();
    });

    it("recovers the provider order by receipt when the local link is missing", async () => {
      vi.mocked(gateway.findOrderByReceipt).mockResolvedValueOnce({ id: "order_TestOrder0001", amountInPaise: 299900, currency: "INR", receipt: order.receipt, status: "created" });
      await service.syncOrderWithProvider({ ...order, gatewayOrderId: null });
      expect(orders.attachGatewayOrderId).toHaveBeenCalledWith(order.id, "order_TestOrder0001");
      expect(gateway.fetchOrderPayments).toHaveBeenCalledWith("order_TestOrder0001");
    });

    it("returns null without side effects when Razorpay has no order for the receipt", async () => {
      vi.mocked(gateway.findOrderByReceipt).mockResolvedValueOnce(null);
      expect(await service.syncOrderWithProvider({ ...order, gatewayOrderId: null })).toBeNull();
      expect(orders.attachGatewayOrderId).not.toHaveBeenCalled();
    });

    it("never syncs legacy Cashfree orders through the Razorpay API", async () => {
      expect(await service.syncOrderWithProvider({ ...order, provider: "cashfree" })).toBeNull();
      expect(gateway.fetchOrderPayments).not.toHaveBeenCalled();
    });
  });

  describe("verifyCheckoutCallback (browser callback is never trusted)", () => {
    const callback = (overrides: Record<string, string> = {}) => ({
      consultationId: order.consultationId,
      reservationToken: TOKEN,
      razorpayOrderId: "order_TestOrder0001",
      razorpayPaymentId: "pay_TestPayment01",
      razorpaySignature: computeRazorpayCheckoutSignature("order_TestOrder0001", "pay_TestPayment01", KEY_SECRET),
      ...overrides,
    });

    it("verifies the signature against the DB order id, fetches the payment and applies the capture", async () => {
      const result = await service.verifyCheckoutCallback(callback());
      expect(gateway.fetchPayment).toHaveBeenCalledWith("pay_TestPayment01");
      expect(result).toMatchObject({ success: true, outcome: "confirmed" });
    });

    it("rejects a forged signature without contacting Razorpay or touching the ledger", async () => {
      const result = await service.verifyCheckoutCallback(callback({ razorpaySignature: "0".repeat(64) }));
      expect(result).toMatchObject({ success: false, error: "SIGNATURE_INVALID" });
      expect(gateway.fetchPayment).not.toHaveBeenCalled();
      expect(ledger.applyPaymentEvent).not.toHaveBeenCalled();
    });

    it("rejects a signature computed for a browser-supplied order id that differs from the DB order", async () => {
      const forged = computeRazorpayCheckoutSignature("order_Attacker0001", "pay_TestPayment01", KEY_SECRET);
      const result = await service.verifyCheckoutCallback(callback({ razorpayOrderId: "order_Attacker0001", razorpaySignature: forged }));
      expect(result).toMatchObject({ success: false, error: "SIGNATURE_INVALID" });
    });

    it("rejects a signature made with the webhook secret instead of the key secret", async () => {
      const wrongSecret = computeRazorpayCheckoutSignature("order_TestOrder0001", "pay_TestPayment01", WEBHOOK_SECRET);
      const result = await service.verifyCheckoutCallback(callback({ razorpaySignature: wrongSecret }));
      expect(result).toMatchObject({ success: false, error: "SIGNATURE_INVALID" });
    });

    it("rejects a wrong payment id for a valid order signature", async () => {
      const result = await service.verifyCheckoutCallback(callback({ razorpayPaymentId: "pay_OtherPayment1" }));
      expect(result).toMatchObject({ success: false, error: "SIGNATURE_INVALID" });
    });

    it("refuses another customer's booking (reservation token mismatch)", async () => {
      const result = await service.verifyCheckoutCallback(callback({ reservationToken: "b".repeat(64) }));
      expect(result).toMatchObject({ success: false, error: "INVALID_RESERVATION_TOKEN" });
      expect(gateway.fetchPayment).not.toHaveBeenCalled();
    });

    it("rejects a payment that Razorpay reports for a different order", async () => {
      vi.mocked(gateway.fetchPayment).mockResolvedValueOnce(payment({ orderId: "order_Other000001" }));
      const result = await service.verifyCheckoutCallback(callback());
      expect(result).toMatchObject({ success: false, error: "PAYMENT_ORDER_MISMATCH" });
      expect(ledger.applyPaymentEvent).not.toHaveBeenCalled();
    });

    it("keeps an authorized (not captured) payment pending instead of confirming it", async () => {
      vi.mocked(gateway.fetchPayment).mockResolvedValueOnce(payment({ status: "authorized" }));
      vi.mocked(ledger.applyPaymentEvent).mockResolvedValueOnce(applied("payment_pending"));
      const result = await service.verifyCheckoutCallback(callback());
      expect(vi.mocked(ledger.applyPaymentEvent).mock.calls[0][0].status).toBe("authorized");
      expect(result).toMatchObject({ success: true, outcome: "payment_pending" });
    });

    it("treats a Razorpay outage as 'still verifying', never as failure", async () => {
      vi.mocked(gateway.fetchPayment).mockRejectedValueOnce(new GatewayError("timeout", { code: "GATEWAY_TIMEOUT" }));
      const result = await service.verifyCheckoutCallback(callback());
      expect(result).toMatchObject({ success: false, error: "GATEWAY_ERROR" });
      if (!result.success) expect(result.message).toContain("do not pay again");
    });

    it("fails closed when the key secret is not configured", async () => {
      const unconfigured = new PaymentConfirmationService({ paymentOrderRepo: orders, ledger, gateway, keySecretResolver: () => undefined });
      const result = await unconfigured.verifyCheckoutCallback(callback());
      expect(result).toMatchObject({ success: false, error: "NOT_CONFIGURED" });
    });

    it("refuses verification for legacy Cashfree orders", async () => {
      vi.mocked(orders.getLatestOrderByConsultationId).mockResolvedValueOnce({ ...order, provider: "cashfree" });
      const result = await service.verifyCheckoutCallback(callback());
      expect(result).toMatchObject({ success: false, error: "ORDER_NOT_FOUND" });
    });
  });

  describe("Legacy Cashfree webhook mapping", () => {
    const cashfree = (eventType: NormalizedCashfreePaymentWebhook["eventType"]): NormalizedCashfreePaymentWebhook => ({
      eventType,
      orderId: "ord_22222222222242228222222222222222",
      gatewayPaymentId: "12345678",
      paymentStatus: "SUCCESS",
      amountInPaise: 299900,
      currency: "INR",
      paymentMethod: "upi",
      bankReference: null,
      errorCode: null,
      errorDescription: null,
      eventTime: "2026-10-01T10:02:00.000Z",
      rawPayload: {},
    });

    it.each([
      ["PAYMENT_SUCCESS_WEBHOOK", "captured"],
      ["PAYMENT_FAILED_WEBHOOK", "failed"],
      ["PAYMENT_USER_DROPPED_WEBHOOK", "user_dropped"],
    ] as const)("maps %s to ledger status %s under provider 'cashfree'", async (type, status) => {
      vi.mocked(orders.getOrderByProviderGatewayId).mockResolvedValueOnce({ ...order, provider: "cashfree", receipt: null });
      await service.processPaymentWebhook(cashfree(type));
      expect(orders.getOrderByProviderGatewayId).toHaveBeenCalledWith("cashfree", "ord_22222222222242228222222222222222");
      expect(vi.mocked(ledger.applyPaymentEvent).mock.calls[0][0].status).toBe(status);
      expect(gateway.fetchOrder).not.toHaveBeenCalled();
    });
  });

  it("normalizes provider payment methods", () => {
    expect(normalizePaymentMethod("UPI")).toBe("upi");
    expect(normalizePaymentMethod("emi")).toBe("card");
    expect(normalizePaymentMethod("netbanking")).toBe("netbanking");
    expect(normalizePaymentMethod("wallet")).toBe("wallet");
    expect(normalizePaymentMethod("cardless_emi_x")).toBe("card");
    expect(normalizePaymentMethod(null)).toBeNull();
  });
});
