/**
 * Cashfree Payment Gateway REST Adapter
 *
 * Implements IPaymentGatewayAdapter using zero external dependencies (native fetch).
 * Communicates strictly with Cashfree PG REST API (x-api-version: 2023-08-01).
 *
 * Core Guarantees:
 * 1. Converts internal integer paise (e.g. 299900) to decimal rupees (2999.00).
 * 2. Enforces 10-second request timeout via AbortController.
 * 3. Recovers gracefully from HTTP 409 'order_already_exists' via GET /orders/{order_id}.
 * 4. Normalizes provider responses into strongly-typed GatewayOrderResult.
 * 5. Masks and redacts sensitive credentials and PII from server logs and error messages.
 */

import { CashfreeConfig, getServerConfig } from "../config/env";
import { logger } from "../logger/logger";
import {
  CreateGatewayOrderParams,
  GatewayError,
  GatewayOrderResult,
  GatewayOrderStatus,
  IPaymentGatewayAdapter,
} from "./payment-gateway.interface";

const CASHFREE_ORDER_ID_REGEX = /^[a-zA-Z0-9_-]{3,45}$/;
const DEFAULT_TIMEOUT_MS = 10000;
const CASHFREE_API_VERSION = "2023-08-01";

export class CashfreePaymentGatewayAdapter implements IPaymentGatewayAdapter {
  private readonly config: CashfreeConfig;
  private readonly timeoutMs: number;

  constructor(config?: CashfreeConfig, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.config = config || getServerConfig().cashfree;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Constructs required Cashfree authentication and version headers.
   * Throws AUTHENTICATION_FAILED if credentials are not configured.
   */
  private getHeaders(): Record<string, string> {
    if (!this.config.appId || !this.config.secretKey) {
      throw new GatewayError("Cashfree credentials are unconfigured or incomplete.", {
        code: "AUTHENTICATION_FAILED",
      });
    }

    return {
      "Content-Type": "application/json",
      "x-api-version": CASHFREE_API_VERSION,
      "x-client-id": this.config.appId,
      "x-client-secret": this.config.secretKey,
    };
  }

  /**
   * Dispatches a fetch request with timeout protection via AbortController.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (
        (err instanceof Error && err.name === "AbortError") ||
        (err as { name?: string })?.name === "AbortError"
      ) {
        throw new GatewayError(
          `Payment gateway request timed out after ${this.timeoutMs}ms`,
          {
            code: "GATEWAY_TIMEOUT",
            cause: err,
          }
        );
      }
      throw new GatewayError(
        "Network failure connecting to Cashfree payment gateway",
        {
          code: "NETWORK_ERROR",
          cause: err,
        }
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Normalizes a raw Cashfree order JSON object into a typed GatewayOrderResult.
   */
  private normalizeOrderResponse(
    raw: unknown,
    statusCode: number
  ): GatewayOrderResult {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new GatewayError("Malformed response payload from payment gateway", {
        code: "MALFORMED_RESPONSE",
        statusCode,
      });
    }

    const data = raw as Record<string, unknown>;

    const cfOrderId = data.cf_order_id;
    const orderId = data.order_id;
    const paymentSessionId = data.payment_session_id;

    if (
      (typeof cfOrderId !== "string" && typeof cfOrderId !== "number") ||
      typeof orderId !== "string" ||
      typeof paymentSessionId !== "string" ||
      !paymentSessionId.trim()
    ) {
      throw new GatewayError(
        "Payment gateway response missing required order identifiers or session token",
        {
          code: "MALFORMED_RESPONSE",
          statusCode,
        }
      );
    }

    const orderAmount =
      typeof data.order_amount === "number"
        ? data.order_amount
        : Number(data.order_amount) || 0;

    const orderCurrency =
      typeof data.order_currency === "string"
        ? data.order_currency
        : "INR";

    const rawStatus = String(data.order_status || "ACTIVE").toUpperCase();
    const orderStatus: GatewayOrderStatus = [
      "ACTIVE",
      "PAID",
      "EXPIRED",
      "TERMINATED",
    ].includes(rawStatus)
      ? (rawStatus as GatewayOrderStatus)
      : "UNKNOWN";

    const orderExpiryTime =
      typeof data.order_expiry_time === "string"
        ? data.order_expiry_time
        : null;

    return {
      gatewayOrderId: String(cfOrderId),
      merchantOrderId: orderId,
      paymentSessionId: paymentSessionId.trim(),
      orderStatus,
      orderAmount,
      orderCurrency,
      orderExpiryTime,
    };
  }

  /**
   * Parses and normalizes Cashfree provider error objects.
   */
  private async parseProviderError(
    res: Response,
    orderId: string
  ): Promise<GatewayError> {
    let errorBody: { message?: string; code?: string; type?: string } | null = null;

    try {
      errorBody = (await res.json()) as {
        message?: string;
        code?: string;
        type?: string;
      };
    } catch {
      // Non-JSON response body
    }

    const providerMessage = errorBody?.message || res.statusText || "Gateway request failed";
    const providerCode = errorBody?.code;
    const providerType = errorBody?.type;

    logger.warn("Cashfree API returned error response", {
      orderId,
      statusCode: res.status,
      providerCode,
      providerType,
    });

    if (res.status === 401 || res.status === 403) {
      return new GatewayError(
        "Payment gateway authentication failed. Please verify credentials.",
        {
          code: "AUTHENTICATION_FAILED",
          statusCode: res.status,
          providerCode,
          providerMessage,
          providerType,
        }
      );
    }

    if (res.status === 409 && providerCode === "order_already_exists") {
      return new GatewayError(
        `Order already exists at payment gateway: ${providerMessage}`,
        {
          code: "ORDER_ALREADY_EXISTS",
          statusCode: 409,
          providerCode,
          providerMessage,
          providerType,
        }
      );
    }

    if (res.status >= 400 && res.status < 500) {
      return new GatewayError(
        `Payment gateway rejected order request: ${providerMessage}`,
        {
          code: "GATEWAY_REJECTED",
          statusCode: res.status,
          providerCode,
          providerMessage,
          providerType,
        }
      );
    }

    return new GatewayError(
      `Payment gateway internal server error: ${providerMessage}`,
      {
        code: "GATEWAY_ERROR",
        statusCode: res.status,
        providerCode,
        providerMessage,
        providerType,
      }
    );
  }

  /**
   * Initializes a payment order with Cashfree.
   * Translates integer paise to decimal rupees and handles 409 recovery.
   */
  async createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult> {
    if (!params.orderId || !CASHFREE_ORDER_ID_REGEX.test(params.orderId)) {
      throw new GatewayError(
        `Invalid orderId: "${params.orderId}". Must be 3-45 alphanumeric characters, hyphens, or underscores.`,
        { code: "GATEWAY_REJECTED" }
      );
    }

    if (!Number.isInteger(params.amountInPaise) || params.amountInPaise <= 0) {
      throw new GatewayError(
        "Order amount must be a strictly positive integer in paise.",
        { code: "GATEWAY_REJECTED" }
      );
    }

    if (params.currency !== "INR") {
      throw new GatewayError(
        `Invalid currency: "${params.currency}". Only INR is supported.`,
        { code: "GATEWAY_REJECTED" }
      );
    }

    if (!params.customer.phone || params.customer.phone.length < 10) {
      throw new GatewayError(
        "Customer phone number is required and must contain at least 10 digits.",
        { code: "GATEWAY_REJECTED" }
      );
    }

    // Precise paise-to-rupees conversion (e.g. 299900 -> 2999.00)
    const orderAmount = Number((params.amountInPaise / 100).toFixed(2));

    const requestBody: Record<string, unknown> = {
      order_id: params.orderId,
      order_amount: orderAmount,
      order_currency: params.currency,
      customer_details: {
        customer_id: params.customer.id,
        customer_phone: params.customer.phone,
        ...(params.customer.name ? { customer_name: params.customer.name } : {}),
        ...(params.customer.email ? { customer_email: params.customer.email } : {}),
      },
    };

    if (params.orderExpiryTime) {
      requestBody.order_expiry_time = params.orderExpiryTime;
    }

    if (params.orderNote) {
      requestBody.order_note = params.orderNote;
    }

    if (params.orderMeta?.returnUrl || params.orderMeta?.notifyUrl) {
      requestBody.order_meta = {
        ...(params.orderMeta.returnUrl ? { return_url: params.orderMeta.returnUrl } : {}),
        ...(params.orderMeta.notifyUrl ? { notify_url: params.orderMeta.notifyUrl } : {}),
      };
    }

    const url = `${this.config.baseUrl}/orders`;
    const headers = this.getHeaders();

    logger.info("Dispatching Cashfree PG order creation request", {
      orderId: params.orderId,
      amountRupees: orderAmount,
      environment: this.config.environment,
    });

    const res = await this.fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    // Handle 409 Conflict: order_already_exists provider recovery
    if (res.status === 409) {
      let conflictBody: { code?: string } | null = null;
      try {
        conflictBody = (await res.json()) as { code?: string };
      } catch {
        // Continue to standard error parsing if response body is not JSON
      }

      if (conflictBody?.code === "order_already_exists") {
        logger.info(
          "Cashfree returned 409 order_already_exists; executing reconciliation query",
          { orderId: params.orderId }
        );

        const existingOrder = await this.getOrder(params.orderId);
        if (existingOrder) {
          logger.info("Successfully recovered existing Cashfree order session", {
            orderId: params.orderId,
            gatewayOrderId: existingOrder.gatewayOrderId,
            orderStatus: existingOrder.orderStatus,
          });
          return existingOrder;
        }

        throw new GatewayError(
          "Cashfree reported order already exists, but order could not be retrieved.",
          {
            code: "ORDER_ALREADY_EXISTS",
            statusCode: 409,
            providerCode: "order_already_exists",
          }
        );
      }
    }

    if (!res.ok) {
      throw await this.parseProviderError(res, params.orderId);
    }

    let jsonResponse: unknown;
    try {
      jsonResponse = await res.json();
    } catch (parseErr) {
      throw new GatewayError(
        "Failed to parse payment gateway JSON response",
        {
          code: "MALFORMED_RESPONSE",
          statusCode: res.status,
          cause: parseErr,
        }
      );
    }

    return this.normalizeOrderResponse(jsonResponse, res.status);
  }

  /**
   * Retrieves an existing order from Cashfree by merchant order identifier.
   * Returns null if the order is not found (HTTP 404).
   */
  async getOrder(orderId: string): Promise<GatewayOrderResult | null> {
    if (!orderId || !CASHFREE_ORDER_ID_REGEX.test(orderId)) {
      throw new GatewayError(
        `Invalid orderId: "${orderId}". Must be 3-45 alphanumeric characters, hyphens, or underscores.`,
        { code: "GATEWAY_REJECTED" }
      );
    }

    const url = `${this.config.baseUrl}/orders/${encodeURIComponent(orderId)}`;
    const headers = this.getHeaders();

    const res = await this.fetchWithTimeout(url, {
      method: "GET",
      headers,
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw await this.parseProviderError(res, orderId);
    }

    let jsonResponse: unknown;
    try {
      jsonResponse = await res.json();
    } catch (parseErr) {
      throw new GatewayError(
        "Failed to parse payment gateway GET order JSON response",
        {
          code: "MALFORMED_RESPONSE",
          statusCode: res.status,
          cause: parseErr,
        }
      );
    }

    return this.normalizeOrderResponse(jsonResponse, res.status);
  }
}
