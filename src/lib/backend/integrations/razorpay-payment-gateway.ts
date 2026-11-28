/**
 * Razorpay Orders / Payments / Refunds adapter (server-only).
 *
 * Contract source: official Razorpay API docs (razorpay.com/docs/api):
 *   POST /v1/orders, GET /v1/orders/{id}, GET /v1/orders?receipt=,
 *   GET /v1/orders/{id}/payments, GET /v1/payments/{id},
 *   POST /v1/payments/{id}/refund (X-Refund-Idempotency), GET /v1/refunds/{id}.
 * Auth: HTTP Basic (key_id:key_secret). Amounts are integer paise.
 *
 * Never logs or returns credentials; provider error text is truncated and only the
 * documented error.code / error.description are kept.
 */

import { getServerConfig } from "../config/env";
import {
  CreateProviderOrderParams,
  CreateProviderRefundParams,
  GatewayError,
  IOrderPaymentGateway,
  ProviderOrder,
  ProviderOrderStatus,
  ProviderPayment,
  ProviderPaymentStatus,
  ProviderRefund,
  ProviderRefundStatus,
} from "./payment-gateway.interface";

export const RAZORPAY_API_BASE_URL = "https://api.razorpay.com/v1";
export const RAZORPAY_REQUEST_TIMEOUT_MS = 10_000;

const ORDER_STATUSES: readonly ProviderOrderStatus[] = ["created", "attempted", "paid"];
const PAYMENT_STATUSES: readonly ProviderPaymentStatus[] = [
  "created",
  "authorized",
  "captured",
  "refunded",
  "failed",
];
const REFUND_STATUSES: readonly ProviderRefundStatus[] = ["pending", "processed", "failed"];
const ID_PATTERN = /^[A-Za-z0-9_]{6,64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

type FetchLike = typeof fetch;

function sanitize(text: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  return text.replace(/[\r\n\t]+/g, " ").slice(0, 200);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function paise(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new GatewayError("Razorpay returned a non-integer amount", { code: "MALFORMED_RESPONSE" });
  }
  return value;
}

export function mapRazorpayOrder(raw: unknown): ProviderOrder {
  const o = asRecord(raw);
  const id = str(o?.id);
  const status = o?.status as ProviderOrderStatus;
  if (!o || !id || o.entity !== "order" || !ORDER_STATUSES.includes(status)) {
    throw new GatewayError("Malformed Razorpay order", { code: "MALFORMED_RESPONSE" });
  }
  return {
    id,
    amountInPaise: paise(o.amount),
    currency: String(o.currency ?? ""),
    receipt: str(o.receipt),
    status,
  };
}

export function mapRazorpayPayment(raw: unknown): ProviderPayment {
  const p = asRecord(raw);
  const id = str(p?.id);
  const status = p?.status as ProviderPaymentStatus;
  if (!p || !id || p.entity !== "payment" || !PAYMENT_STATUSES.includes(status)) {
    throw new GatewayError("Malformed Razorpay payment", { code: "MALFORMED_RESPONSE" });
  }
  const acquirer = asRecord(p.acquirer_data);
  return {
    id,
    orderId: str(p.order_id),
    amountInPaise: paise(p.amount),
    currency: String(p.currency ?? ""),
    status,
    method: str(p.method),
    bankReference: str(acquirer?.rrn) ?? str(acquirer?.upi_transaction_id) ?? str(acquirer?.bank_transaction_id),
    errorCode: str(p.error_code),
    errorDescription: sanitize(p.error_description) ?? null,
    createdAt:
      typeof p.created_at === "number" ? new Date(p.created_at * 1000).toISOString() : null,
  };
}

export function mapRazorpayRefund(raw: unknown): ProviderRefund {
  const r = asRecord(raw);
  const id = str(r?.id);
  const paymentId = str(r?.payment_id);
  const status = r?.status as ProviderRefundStatus;
  if (!r || !id || !paymentId || r.entity !== "refund" || !REFUND_STATUSES.includes(status)) {
    throw new GatewayError("Malformed Razorpay refund", { code: "MALFORMED_RESPONSE" });
  }
  const localRefundId = str(asRecord(r.notes)?.refund_id);
  return {
    id,
    paymentId,
    amountInPaise: paise(r.amount),
    status,
    localRefundId: localRefundId && UUID_PATTERN.test(localRefundId) ? localRefundId : null,
  };
}

export class RazorpayPaymentGateway implements IOrderPaymentGateway {
  readonly provider = "razorpay" as const;
  private readonly credentials?: RazorpayCredentials;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options?: { credentials?: RazorpayCredentials; fetchImpl?: FetchLike; timeoutMs?: number }) {
    this.credentials = options?.credentials;
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.timeoutMs = options?.timeoutMs ?? RAZORPAY_REQUEST_TIMEOUT_MS;
  }

  private resolveCredentials(): RazorpayCredentials {
    if (this.credentials) return this.credentials;
    const cfg = getServerConfig().razorpay;
    if (!cfg.isConfigured || !cfg.keyId || !cfg.keySecret) {
      throw new GatewayError("Razorpay is not configured", { code: "AUTHENTICATION_FAILED" });
    }
    return { keyId: cfg.keyId, keySecret: cfg.keySecret };
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    options?: { body?: unknown; headers?: Record<string, string>; allow404?: boolean }
  ): Promise<unknown | null> {
    const { keyId, keySecret } = this.resolveCredentials();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${RAZORPAY_API_BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          Accept: "application/json",
          ...(options?.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...options?.headers,
        },
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (err) {
      const aborted = (err as { name?: string })?.name === "AbortError";
      throw new GatewayError(aborted ? "Razorpay request timed out" : "Razorpay network error", {
        code: aborted ? "GATEWAY_TIMEOUT" : "NETWORK_ERROR",
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (response.ok) {
      if (json === null) {
        throw new GatewayError("Razorpay returned an unreadable body", { code: "MALFORMED_RESPONSE" });
      }
      return json;
    }

    if (response.status === 404 && options?.allow404) return null;

    const error = asRecord(asRecord(json)?.error);
    const providerCode = sanitize(error?.code);
    const providerMessage = sanitize(error?.description);
    const common = { statusCode: response.status, providerCode, providerMessage };

    if (response.status === 401) {
      throw new GatewayError("Razorpay authentication failed", { code: "AUTHENTICATION_FAILED", ...common });
    }
    if (response.status === 409) {
      throw new GatewayError("Razorpay idempotency conflict", { code: "IDEMPOTENCY_CONFLICT", ...common });
    }
    if (response.status === 400 && /duplicate request|already been processed/i.test(providerMessage ?? "")) {
      throw new GatewayError("Razorpay reports a duplicate request", { code: "ORDER_ALREADY_EXISTS", ...common });
    }
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      throw new GatewayError("Razorpay rejected the request", { code: "GATEWAY_REJECTED", ...common });
    }
    throw new GatewayError("Razorpay service error", { code: "GATEWAY_ERROR", ...common });
  }

  private assertId(id: string): void {
    if (!ID_PATTERN.test(id)) {
      throw new GatewayError("Invalid Razorpay identifier", { code: "GATEWAY_REJECTED" });
    }
  }

  async createOrder(params: CreateProviderOrderParams): Promise<ProviderOrder> {
    if (!Number.isSafeInteger(params.amountInPaise) || params.amountInPaise < 100) {
      throw new GatewayError("Order amount must be integer paise >= 100", { code: "GATEWAY_REJECTED" });
    }
    if (params.currency !== "INR") {
      throw new GatewayError("Only INR is supported", { code: "GATEWAY_REJECTED" });
    }
    if (!/^[\x20-\x7E]{1,40}$/.test(params.receipt)) {
      throw new GatewayError("Receipt must be 1-40 printable ASCII characters", { code: "GATEWAY_REJECTED" });
    }

    try {
      const raw = await this.request("POST", "/orders", {
        body: {
          amount: params.amountInPaise,
          currency: params.currency,
          receipt: params.receipt,
          notes: params.notes ?? {},
        },
      });
      const order = mapRazorpayOrder(raw);
      this.assertMatches(order, params);
      return order;
    } catch (err) {
      // Receipt is treated as an idempotency key by Razorpay: a duplicate means an
      // earlier attempt succeeded. Recover it instead of creating another order.
      if (err instanceof GatewayError && err.code === "ORDER_ALREADY_EXISTS") {
        const existing = await this.findOrderByReceipt(params.receipt);
        if (existing) {
          this.assertMatches(existing, params);
          return existing;
        }
      }
      throw err;
    }
  }

  private assertMatches(order: ProviderOrder, params: CreateProviderOrderParams): void {
    if (order.amountInPaise !== params.amountInPaise || order.currency !== params.currency) {
      throw new GatewayError("Razorpay order does not match the requested amount/currency", {
        code: "MALFORMED_RESPONSE",
      });
    }
  }

  async fetchOrder(orderId: string): Promise<ProviderOrder | null> {
    this.assertId(orderId);
    const raw = await this.request("GET", `/orders/${orderId}`, { allow404: true });
    return raw === null ? null : mapRazorpayOrder(raw);
  }

  async findOrderByReceipt(receipt: string): Promise<ProviderOrder | null> {
    const raw = asRecord(
      await this.request("GET", `/orders?receipt=${encodeURIComponent(receipt)}&count=10`)
    );
    if (!raw || !Array.isArray(raw.items)) {
      throw new GatewayError("Malformed Razorpay order collection", { code: "MALFORMED_RESPONSE" });
    }
    // The filter is documented as "contains"; require an exact match.
    const matches = raw.items.map(mapRazorpayOrder).filter((o) => o.receipt === receipt);
    if (matches.length > 1) {
      throw new GatewayError("Multiple Razorpay orders share one receipt", { code: "MALFORMED_RESPONSE" });
    }
    return matches[0] ?? null;
  }

  async fetchOrderPayments(orderId: string): Promise<ProviderPayment[]> {
    this.assertId(orderId);
    const raw = asRecord(await this.request("GET", `/orders/${orderId}/payments`));
    if (!raw || !Array.isArray(raw.items)) {
      throw new GatewayError("Malformed Razorpay payment collection", { code: "MALFORMED_RESPONSE" });
    }
    return raw.items.map(mapRazorpayPayment);
  }

  async fetchPayment(paymentId: string): Promise<ProviderPayment | null> {
    this.assertId(paymentId);
    // Razorpay answers an unknown payment id with 400 ("does not exist"), not 404.
    try {
      const raw = await this.request("GET", `/payments/${paymentId}`, { allow404: true });
      return raw === null ? null : mapRazorpayPayment(raw);
    } catch (err) {
      if (err instanceof GatewayError && err.statusCode === 400 && /does not exist/i.test(err.providerMessage ?? "")) {
        return null;
      }
      throw err;
    }
  }

  async createRefund(params: CreateProviderRefundParams): Promise<ProviderRefund> {
    this.assertId(params.paymentId);
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(params.idempotencyKey)) {
      throw new GatewayError("Invalid refund idempotency key", { code: "GATEWAY_REJECTED" });
    }
    if (!Number.isSafeInteger(params.amountInPaise) || params.amountInPaise <= 0) {
      throw new GatewayError("Refund amount must be positive integer paise", { code: "GATEWAY_REJECTED" });
    }
    const raw = await this.request("POST", `/payments/${params.paymentId}/refund`, {
      // Body must be byte-identical on retries of the same logical refund.
      body: { amount: params.amountInPaise, notes: params.notes ?? {} },
      headers: { "X-Refund-Idempotency": params.idempotencyKey },
    });
    const refund = mapRazorpayRefund(raw);
    if (refund.paymentId !== params.paymentId || refund.amountInPaise !== params.amountInPaise) {
      throw new GatewayError("Razorpay refund does not match the request", { code: "MALFORMED_RESPONSE" });
    }
    return refund;
  }

  async fetchRefund(refundId: string): Promise<ProviderRefund | null> {
    this.assertId(refundId);
    const raw = await this.request("GET", `/refunds/${refundId}`, { allow404: true });
    return raw === null ? null : mapRazorpayRefund(raw);
  }

  async fetchPaymentRefunds(paymentId: string): Promise<ProviderRefund[]> {
    this.assertId(paymentId);
    const raw = asRecord(await this.request("GET", `/payments/${paymentId}/refunds?count=100`));
    if (!raw || !Array.isArray(raw.items)) {
      throw new GatewayError("Malformed Razorpay refund collection", { code: "MALFORMED_RESPONSE" });
    }
    return raw.items.map(mapRazorpayRefund);
  }
}
