import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CashfreePaymentGatewayAdapter } from "../cashfree-payment-gateway-adapter";
import {
  CreateGatewayOrderParams,
  GatewayError,
} from "../payment-gateway.interface";
import { CashfreeConfig } from "../../config/env";

describe("CashfreePaymentGatewayAdapter Suite", () => {
  const mockSandboxConfig: CashfreeConfig = {
    appId: "cf_test_app_id_12345",
    secretKey: "cf_test_secret_key_67890",
    environment: "sandbox",
    baseUrl: "https://sandbox.cashfree.com/pg",
    isConfigured: true,
  };

  const mockProductionConfig: CashfreeConfig = {
    appId: "cf_prod_app_id_99999",
    secretKey: "cf_prod_secret_key_88888",
    environment: "production",
    baseUrl: "https://api.cashfree.com/pg",
    isConfigured: true,
  };

  const standardOrderParams: CreateGatewayOrderParams = {
    orderId: "ord_test_order_123",
    amountInPaise: 299900, // ₹2,999.00
    currency: "INR",
    customer: {
      id: "cust_user_456",
      phone: "9876543210",
      name: "Ananya Roy",
      email: "ananya.roy@example.com",
    },
    orderExpiryTime: "2026-09-16T16:30:00Z",
    orderMeta: {
      returnUrl: "https://eventsika.in/payment/return?order_id={order_id}",
      notifyUrl: "https://eventsika.in/api/payments/webhook",
    },
    orderNote: "Consultation Booking",
  };

  const mockSuccessResponse = {
    cf_order_id: 10293847,
    order_id: "ord_test_order_123",
    entity: "order",
    order_currency: "INR",
    order_amount: 2999.0,
    order_status: "ACTIVE",
    payment_session_id: "session_mock_token_abc123xyz789",
    order_expiry_time: "2026-09-16T16:30:00Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Configuration & Environment Resolution", () => {
    it("throws AUTHENTICATION_FAILED if credentials are not configured", async () => {
      const unconfiguredConfig: CashfreeConfig = {
        appId: undefined,
        secretKey: undefined,
        environment: "sandbox",
        baseUrl: "https://sandbox.cashfree.com/pg",
        isConfigured: false,
      };

      const adapter = new CashfreePaymentGatewayAdapter(unconfiguredConfig);
      await expect(adapter.createOrder(standardOrderParams)).rejects.toThrow(GatewayError);

      try {
        await adapter.createOrder(standardOrderParams);
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        expect((err as GatewayError).code).toBe("AUTHENTICATION_FAILED");
      }
    });

    it("uses sandbox base URL when environment is sandbox", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);
      await adapter.createOrder(standardOrderParams);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://sandbox.cashfree.com/pg/orders");
    });

    it("uses production base URL when environment is production", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockProductionConfig);
      await adapter.createOrder(standardOrderParams);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe("https://api.cashfree.com/pg/orders");
    });

    it("hard-locks API version to 2023-08-01 regardless of external factors", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);
      await adapter.createOrder(standardOrderParams);

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options?.headers as Record<string, string>;
      expect(headers["x-api-version"]).toBe("2023-08-01");
    });
  });

  describe("Request Construction & Monetary Conversion", () => {
    it("correctly sets headers including hard-locked x-api-version 2023-08-01 and credentials", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);
      await adapter.createOrder(standardOrderParams);

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options?.headers as Record<string, string>;

      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["x-api-version"]).toBe("2023-08-01");
      expect(headers["x-client-id"]).toBe("cf_test_app_id_12345");
      expect(headers["x-client-secret"]).toBe("cf_test_secret_key_67890");
    });

    it("converts 299900 integer paise to 2999.00 rupees in request payload", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);
      await adapter.createOrder(standardOrderParams);

      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse(options?.body as string);

      expect(body.order_amount).toBe(2999.0);
      expect(body.order_currency).toBe("INR");
      expect(body.order_id).toBe("ord_test_order_123");
      expect(body.customer_details.customer_id).toBe("cust_user_456");
      expect(body.customer_details.customer_phone).toBe("9876543210");
      expect(body.customer_details.customer_name).toBe("Ananya Roy");
      expect(body.customer_details.customer_email).toBe("ananya.roy@example.com");
      expect(body.order_expiry_time).toBe("2026-09-16T16:30:00Z");
      expect(body.order_note).toBe("Consultation Booking");
      expect(body.order_meta.return_url).toBe("https://eventsika.in/payment/return?order_id={order_id}");
      expect(body.order_meta.notify_url).toBe("https://eventsika.in/api/payments/webhook");
    });

    it("converts arbitrary valid paise amounts accurately (100 -> 1.00, 5050 -> 50.50, 1 -> 0.01)", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      // Test 100 paise
      await adapter.createOrder({ ...standardOrderParams, amountInPaise: 100 });
      let body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(body.order_amount).toBe(1.0);

      // Test 5050 paise
      await adapter.createOrder({ ...standardOrderParams, amountInPaise: 5050 });
      body = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string);
      expect(body.order_amount).toBe(50.5);

      // Test 1 paise
      await adapter.createOrder({ ...standardOrderParams, amountInPaise: 1 });
      body = JSON.parse(fetchSpy.mock.calls[2][1]?.body as string);
      expect(body.order_amount).toBe(0.01);
    });

    it("rejects non-integer, zero, or negative amountInPaise before network call", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      await expect(
        adapter.createOrder({ ...standardOrderParams, amountInPaise: 2999.5 })
      ).rejects.toThrow(/strictly positive integer in paise/);

      await expect(
        adapter.createOrder({ ...standardOrderParams, amountInPaise: 0 })
      ).rejects.toThrow(/strictly positive integer in paise/);

      await expect(
        adapter.createOrder({ ...standardOrderParams, amountInPaise: -500 })
      ).rejects.toThrow(/strictly positive integer in paise/);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects invalid orderId formats", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      // Too short (< 3 chars)
      await expect(
        adapter.createOrder({ ...standardOrderParams, orderId: "ab" })
      ).rejects.toThrow(/Invalid orderId/);

      // Invalid special characters
      await expect(
        adapter.createOrder({ ...standardOrderParams, orderId: "ord@invalid!#$" })
      ).rejects.toThrow(/Invalid orderId/);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects non-INR currencies", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      await expect(
        adapter.createOrder({
          ...standardOrderParams,
          // @ts-expect-error Testing runtime guard against invalid currency
          currency: "USD",
        })
      ).rejects.toThrow(/Only INR is supported/);

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("Successful Response Normalization", () => {
    it("returns strongly-typed GatewayOrderResult with extracted paymentSessionId", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);
      const result = await adapter.createOrder(standardOrderParams);

      expect(result).toEqual({
        gatewayOrderId: "10293847",
        merchantOrderId: "ord_test_order_123",
        paymentSessionId: "session_mock_token_abc123xyz789",
        orderStatus: "ACTIVE",
        orderAmount: 2999.0,
        orderCurrency: "INR",
        orderExpiryTime: "2026-09-16T16:30:00Z",
      });
    });
  });

  describe("HTTP 409 order_already_exists Auto-Recovery", () => {
    it("intercepts 409 order_already_exists and recovers existing order session via GET", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      // First call (POST): returns 409 Conflict with order_already_exists
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          code: "order_already_exists",
          message: "order already exists with the given order_id",
          type: "invalid_request_error",
        }),
      } as Response);

      // Second call (GET /orders/ord_test_order_123): returns active order
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...mockSuccessResponse,
          order_status: "ACTIVE",
          payment_session_id: "session_recovered_token_456",
        }),
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);
      const result = await adapter.createOrder(standardOrderParams);

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // 1st request was POST to create
      expect(fetchSpy.mock.calls[0][0]).toBe("https://sandbox.cashfree.com/pg/orders");
      expect(fetchSpy.mock.calls[0][1]?.method).toBe("POST");
      expect((fetchSpy.mock.calls[0][1]?.headers as Record<string, string>)["x-api-version"]).toBe("2023-08-01");

      // 2nd request was GET to recover
      expect(fetchSpy.mock.calls[1][0]).toBe(
        "https://sandbox.cashfree.com/pg/orders/ord_test_order_123"
      );
      expect(fetchSpy.mock.calls[1][1]?.method).toBe("GET");
      expect((fetchSpy.mock.calls[1][1]?.headers as Record<string, string>)["x-api-version"]).toBe("2023-08-01");

      expect(result.paymentSessionId).toBe("session_recovered_token_456");
      expect(result.orderStatus).toBe("ACTIVE");
    });

    it("throws ORDER_ALREADY_EXISTS if 409 recovery query returns 404 or fails", async () => {
      vi.spyOn(globalThis, "fetch")
        // POST returns 409
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({
            code: "order_already_exists",
            message: "order already exists",
            type: "invalid_request_error",
          }),
        } as Response)
        // GET recovery returns 404
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({
            code: "order_not_found",
            message: "order not found",
            type: "invalid_request_error",
          }),
        } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      await expect(adapter.createOrder(standardOrderParams)).rejects.toThrow(
        /Cashfree reported order already exists/
      );
    });
  });

  describe("GET Order Implementation", () => {
    it("successfully retrieves and normalizes an existing order by orderId", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);
      const result = await adapter.getOrder("ord_test_order_123");

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://sandbox.cashfree.com/pg/orders/ord_test_order_123",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "x-api-version": "2023-08-01",
          }),
        })
      );

      const [, options] = fetchSpy.mock.calls[0];
      const headers = options?.headers as Record<string, string>;
      expect(headers["x-api-version"]).toBe("2023-08-01");

      expect(result).not.toBeNull();
      expect(result?.merchantOrderId).toBe("ord_test_order_123");
      expect(result?.paymentSessionId).toBe("session_mock_token_abc123xyz789");
    });

    it("returns null when GET /orders/{order_id} responds with 404 Not Found", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ code: "order_not_found" }),
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);
      const result = await adapter.getOrder("ord_non_existent_404");

      expect(result).toBeNull();
    });
  });

  describe("Timeout and AbortController Protection", () => {
    it("enforces timeout and throws GATEWAY_TIMEOUT on delayed provider response", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementationOnce((_url, options) => {
        return new Promise((_resolve, reject) => {
          const signal = options?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              const err = new Error("This operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      });

      // Quick 50ms timeout for test speed
      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig, 50);

      try {
        await adapter.createOrder(standardOrderParams);
        expect.unreachable("Should have thrown GATEWAY_TIMEOUT");
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        const gwErr = err as GatewayError;
        expect(gwErr.code).toBe("GATEWAY_TIMEOUT");
        expect(gwErr.message).toContain("timed out after 50ms");
      }
    });
  });

  describe("Error Mapping & Normalization", () => {
    it("maps HTTP 400 rejection to GATEWAY_REJECTED with provider details", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          code: "customer_details_invalid",
          message: "Customer phone is invalid",
          type: "invalid_request_error",
        }),
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      try {
        await adapter.createOrder(standardOrderParams);
        expect.unreachable("Should have thrown GATEWAY_REJECTED");
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        const gwErr = err as GatewayError;
        expect(gwErr.code).toBe("GATEWAY_REJECTED");
        expect(gwErr.statusCode).toBe(400);
        expect(gwErr.providerCode).toBe("customer_details_invalid");
        expect(gwErr.providerMessage).toBe("Customer phone is invalid");
      }
    });

    it("maps HTTP 401/403 to AUTHENTICATION_FAILED", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({
          code: "authentication_failed",
          message: "Invalid App ID or Secret Key",
        }),
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      try {
        await adapter.createOrder(standardOrderParams);
        expect.unreachable("Should have thrown AUTHENTICATION_FAILED");
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        const gwErr = err as GatewayError;
        expect(gwErr.code).toBe("AUTHENTICATION_FAILED");
        expect(gwErr.statusCode).toBe(401);
      }
    });

    it("maps HTTP 500/502/503 to GATEWAY_ERROR", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => ({
          code: "internal_gateway_error",
          message: "Upstream gateway connection issue",
        }),
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      try {
        await adapter.createOrder(standardOrderParams);
        expect.unreachable("Should have thrown GATEWAY_ERROR");
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        const gwErr = err as GatewayError;
        expect(gwErr.code).toBe("GATEWAY_ERROR");
        expect(gwErr.statusCode).toBe(502);
      }
    });

    it("maps network fetch failure to NETWORK_ERROR", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new TypeError("fetch failed: ENOTFOUND api.cashfree.com")
      );

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      try {
        await adapter.createOrder(standardOrderParams);
        expect.unreachable("Should have thrown NETWORK_ERROR");
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        const gwErr = err as GatewayError;
        expect(gwErr.code).toBe("NETWORK_ERROR");
      }
    });

    it("throws MALFORMED_RESPONSE when HTTP 200 response is missing payment_session_id", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cf_order_id: 12345,
          order_id: "ord_123",
          // Missing payment_session_id
        }),
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      try {
        await adapter.createOrder(standardOrderParams);
        expect.unreachable("Should have thrown MALFORMED_RESPONSE");
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        const gwErr = err as GatewayError;
        expect(gwErr.code).toBe("MALFORMED_RESPONSE");
      }
    });

    it("throws MALFORMED_RESPONSE when HTTP 200 response contains non-JSON text", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON at position 0");
        },
      } as unknown as Response);

      const adapter = new CashfreePaymentGatewayAdapter(mockSandboxConfig);

      try {
        await adapter.createOrder(standardOrderParams);
        expect.unreachable("Should have thrown MALFORMED_RESPONSE");
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        const gwErr = err as GatewayError;
        expect(gwErr.code).toBe("MALFORMED_RESPONSE");
      }
    });
  });

  describe("Security & Credential Non-Exposure", () => {
    it("never includes x-client-secret or authorization materials in error messages or thrown objects", async () => {
      const secretKey = "super_confidential_secret_key_xyz_999";
      const configWithSecret: CashfreeConfig = {
        ...mockSandboxConfig,
        secretKey,
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          code: "bad_request",
          message: "Sample error",
        }),
      } as Response);

      const adapter = new CashfreePaymentGatewayAdapter(configWithSecret);

      try {
        await adapter.createOrder(standardOrderParams);
      } catch (err) {
        const serialized = JSON.stringify(err);
        const message = (err as Error).message;

        expect(serialized).not.toContain(secretKey);
        expect(message).not.toContain(secretKey);
      }
    });
  });
});
