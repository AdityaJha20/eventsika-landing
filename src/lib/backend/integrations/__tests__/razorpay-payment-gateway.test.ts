import { describe, it, expect, vi } from "vitest";
import { RazorpayPaymentGateway, RAZORPAY_API_BASE_URL } from "../razorpay-payment-gateway";
import { GatewayError } from "../payment-gateway.interface";

const CREDENTIALS = { keyId: "rzp_test_UnitTestKey000", keySecret: "unit-test-key-secret" };
const RECEIPT = "rcpt_c7c88b90d4614fa3a75df152d113ba4c";

const orderEntity = (overrides: Record<string, unknown> = {}) => ({
  id: "order_TestOrder0001",
  entity: "order",
  amount: 299900,
  amount_paid: 0,
  amount_due: 299900,
  currency: "INR",
  receipt: RECEIPT,
  status: "created",
  attempts: 0,
  notes: {},
  created_at: 1790000000,
  ...overrides,
});

const paymentEntity = (overrides: Record<string, unknown> = {}) => ({
  id: "pay_TestPayment01",
  entity: "payment",
  amount: 299900,
  currency: "INR",
  status: "captured",
  order_id: "order_TestOrder0001",
  method: "upi",
  captured: true,
  email: "customer@example.com",
  contact: "+919876543210",
  error_code: null,
  error_description: null,
  acquirer_data: { rrn: "123456789012" },
  created_at: 1790000100,
  ...overrides,
});

const refundEntity = (overrides: Record<string, unknown> = {}) => ({
  id: "rfnd_TestRefund01",
  entity: "refund",
  amount: 299900,
  currency: "INR",
  payment_id: "pay_TestPayment01",
  status: "pending",
  ...overrides,
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function gatewayWith(...responses: Array<Response | Error>) {
  const fetchImpl = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchImpl.mockRejectedValueOnce(r);
    else fetchImpl.mockResolvedValueOnce(r);
  }
  const gateway = new RazorpayPaymentGateway({ credentials: CREDENTIALS, fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 50 });
  return { gateway, fetchImpl };
}

async function expectGatewayError(promise: Promise<unknown>, code: GatewayError["code"]) {
  const err = await promise.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(GatewayError);
  expect((err as GatewayError).code).toBe(code);
  // Credentials never appear in error text.
  expect(String((err as Error).message)).not.toContain(CREDENTIALS.keySecret);
  return err as GatewayError;
}

describe("RazorpayPaymentGateway", () => {
  describe("createOrder", () => {
    it("POSTs integer paise, INR and the receipt with Basic auth over HTTPS", async () => {
      const { gateway, fetchImpl } = gatewayWith(json(200, orderEntity()));
      const order = await gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR", notes: { a: "b" } });

      expect(order).toEqual({ id: "order_TestOrder0001", amountInPaise: 299900, currency: "INR", receipt: RECEIPT, status: "created" });
      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe(`${RAZORPAY_API_BASE_URL}/orders`);
      expect(url.startsWith("https://")).toBe(true);
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ amount: 299900, currency: "INR", receipt: RECEIPT, notes: { a: "b" } });
      expect(init.headers.Authorization).toBe(
        `Basic ${Buffer.from(`${CREDENTIALS.keyId}:${CREDENTIALS.keySecret}`).toString("base64")}`
      );
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it.each([
      [{ amountInPaise: 99, currency: "INR", receipt: RECEIPT }],
      [{ amountInPaise: 2999.5, currency: "INR", receipt: RECEIPT }],
      [{ amountInPaise: 299900, currency: "USD", receipt: RECEIPT }],
      [{ amountInPaise: 299900, currency: "INR", receipt: "x".repeat(41) }],
    ])("rejects invalid order parameters locally (%o)", async (params) => {
      const { gateway, fetchImpl } = gatewayWith();
      await expectGatewayError(gateway.createOrder(params as never), "GATEWAY_REJECTED");
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("recovers the existing order when Razorpay reports a duplicate receipt", async () => {
      const { gateway, fetchImpl } = gatewayWith(
        json(400, { error: { code: "BAD_REQUEST_ERROR", description: "Duplicate request. This request has already been processed." } }),
        json(200, { entity: "collection", count: 1, items: [orderEntity({ status: "attempted" })] })
      );
      const order = await gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR" });
      expect(order.id).toBe("order_TestOrder0001");
      expect(fetchImpl.mock.calls[1][0]).toBe(`${RAZORPAY_API_BASE_URL}/orders?receipt=${RECEIPT}&count=10`);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("refuses an order whose amount differs from the request", async () => {
      const { gateway } = gatewayWith(json(200, orderEntity({ amount: 100 })));
      await expectGatewayError(gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR" }), "MALFORMED_RESPONSE");
    });

    it("maps 401 to AUTHENTICATION_FAILED", async () => {
      const { gateway } = gatewayWith(json(401, { error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" } }));
      await expectGatewayError(gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR" }), "AUTHENTICATION_FAILED");
    });

    it("maps an abort to GATEWAY_TIMEOUT (unknown outcome) and a socket error to NETWORK_ERROR", async () => {
      const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
      await expectGatewayError(gatewayWith(abort).gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR" }), "GATEWAY_TIMEOUT");
      await expectGatewayError(gatewayWith(new Error("ECONNRESET")).gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR" }), "NETWORK_ERROR");
    });

    it("actually aborts a hung request after the timeout", async () => {
      const fetchImpl = vi.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        })
      );
      const gateway = new RazorpayPaymentGateway({ credentials: CREDENTIALS, fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 10 });
      await expectGatewayError(gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR" }), "GATEWAY_TIMEOUT");
    });

    it("maps 5xx/429 to GATEWAY_ERROR and other 4xx to GATEWAY_REJECTED with sanitized text", async () => {
      await expectGatewayError(gatewayWith(json(503, {})).gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR" }), "GATEWAY_ERROR");
      await expectGatewayError(gatewayWith(json(429, {})).gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR" }), "GATEWAY_ERROR");
      const err = await expectGatewayError(
        gatewayWith(json(400, { error: { code: "BAD_REQUEST_ERROR", description: "bad\nfield " + "z".repeat(400) } })).gateway.createOrder({
          receipt: RECEIPT,
          amountInPaise: 299900,
          currency: "INR",
        }),
        "GATEWAY_REJECTED"
      );
      expect(err.providerMessage!.length).toBeLessThanOrEqual(200);
      expect(err.providerMessage).not.toContain("\n");
    });

    it("treats an unreadable success body as MALFORMED_RESPONSE", async () => {
      const { gateway } = gatewayWith(new Response("<html>", { status: 200 }));
      await expectGatewayError(gateway.createOrder({ receipt: RECEIPT, amountInPaise: 299900, currency: "INR" }), "MALFORMED_RESPONSE");
    });
  });

  describe("lookups", () => {
    it("findOrderByReceipt requires an exact receipt match", async () => {
      const { gateway } = gatewayWith(json(200, { entity: "collection", count: 1, items: [orderEntity({ receipt: `${RECEIPT}x` })] }));
      expect(await gateway.findOrderByReceipt(RECEIPT)).toBeNull();
    });

    it("fetchOrder returns null on 404", async () => {
      const { gateway } = gatewayWith(json(404, { error: { code: "BAD_REQUEST_ERROR", description: "not found" } }));
      expect(await gateway.fetchOrder("order_TestOrder0001")).toBeNull();
    });

    it("fetchOrderPayments normalizes payments and drops customer contact data", async () => {
      const { gateway } = gatewayWith(json(200, { entity: "collection", count: 1, items: [paymentEntity({ status: "authorized", captured: false })] }));
      const [p] = await gateway.fetchOrderPayments("order_TestOrder0001");
      expect(p).toMatchObject({ id: "pay_TestPayment01", status: "authorized", amountInPaise: 299900, bankReference: "123456789012" });
      expect(JSON.stringify(p)).not.toContain("customer@example.com");
      expect(JSON.stringify(p)).not.toContain("9876543210");
    });

    it("fetchPayment returns null for Razorpay's 'does not exist' 400", async () => {
      const { gateway } = gatewayWith(json(400, { error: { code: "BAD_REQUEST_ERROR", description: "The id provided does not exist" } }));
      expect(await gateway.fetchPayment("pay_TestPayment01")).toBeNull();
    });

    it("rejects malformed identifiers before any request (no path injection)", async () => {
      const { gateway, fetchImpl } = gatewayWith();
      await expectGatewayError(gateway.fetchPayment("pay_../../orders"), "GATEWAY_REJECTED");
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects malformed provider entities", async () => {
      const { gateway } = gatewayWith(json(200, paymentEntity({ amount: "2999" })));
      await expectGatewayError(gateway.fetchPayment("pay_TestPayment01"), "MALFORMED_RESPONSE");
    });
  });

  describe("refunds", () => {
    it("sends X-Refund-Idempotency and an amount-only body derived from the request", async () => {
      const { gateway, fetchImpl } = gatewayWith(json(200, refundEntity()));
      const refund = await gateway.createRefund({ paymentId: "pay_TestPayment01", amountInPaise: 299900, idempotencyKey: "rf_0123456789abcdef", notes: { refund_id: "r1" } });
      expect(refund).toEqual({ id: "rfnd_TestRefund01", paymentId: "pay_TestPayment01", amountInPaise: 299900, status: "pending", localRefundId: null });
      const [url, init] = fetchImpl.mock.calls[0];
      expect(url).toBe(`${RAZORPAY_API_BASE_URL}/payments/pay_TestPayment01/refund`);
      expect(init.headers["X-Refund-Idempotency"]).toBe("rf_0123456789abcdef");
      expect(JSON.parse(init.body)).toEqual({ amount: 299900, notes: { refund_id: "r1" } });
    });

    it("produces a byte-identical body when the same logical refund is retried", async () => {
      const { gateway, fetchImpl } = gatewayWith(json(200, refundEntity()), json(200, refundEntity()));
      const params = { paymentId: "pay_TestPayment01", amountInPaise: 299900, idempotencyKey: "rf_0123456789abcdef", notes: { refund_id: "r1" } };
      await gateway.createRefund(params);
      await gateway.createRefund(params);
      expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body);
      expect(fetchImpl.mock.calls[0][1].headers["X-Refund-Idempotency"]).toBe(fetchImpl.mock.calls[1][1].headers["X-Refund-Idempotency"]);
    });

    it("maps 409 to IDEMPOTENCY_CONFLICT", async () => {
      const { gateway } = gatewayWith(json(409, { error: { code: "BAD_REQUEST_ERROR", description: "request in progress" } }));
      await expectGatewayError(
        gateway.createRefund({ paymentId: "pay_TestPayment01", amountInPaise: 299900, idempotencyKey: "rf_0123456789abcdef" }),
        "IDEMPOTENCY_CONFLICT"
      );
    });

    it("rejects idempotency keys outside the documented format", async () => {
      const { gateway, fetchImpl } = gatewayWith();
      await expectGatewayError(gateway.createRefund({ paymentId: "pay_TestPayment01", amountInPaise: 100, idempotencyKey: "short" }), "GATEWAY_REJECTED");
      await expectGatewayError(gateway.createRefund({ paymentId: "pay_TestPayment01", amountInPaise: 100, idempotencyKey: "has space in key!!" }), "GATEWAY_REJECTED");
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("fetchRefund normalizes processed refunds", async () => {
      const { gateway } = gatewayWith(json(200, refundEntity({ status: "processed" })));
      expect((await gateway.fetchRefund("rfnd_TestRefund01"))?.status).toBe("processed");
    });
  });

  it("fails without credentials instead of calling Razorpay", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    const fetchImpl = vi.fn();
    const gateway = new RazorpayPaymentGateway({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await expectGatewayError(gateway.fetchOrder("order_TestOrder0001"), "AUTHENTICATION_FAILED");
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
