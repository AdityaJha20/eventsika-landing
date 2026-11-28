/**
 * Provider-Agnostic Payment Gateway Contracts & Interfaces
 *
 * Defines the core boundary contract for payment gateway adapters in Eventsika.
 * Decouples domain services from third-party gateway SDKs and REST schemas.
 */

export interface GatewayCustomerDetails {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
}

export interface GatewayOrderMeta {
  returnUrl?: string | null;
  notifyUrl?: string | null;
}

export interface CreateGatewayOrderParams {
  orderId: string;           // Merchant-assigned order identifier (e.g. 3-45 chars)
  amountInPaise: number;     // Authoritative integer paise (e.g. 299900 = ₹2,999)
  currency: "INR";           // Fixed currency
  customer: GatewayCustomerDetails;
  orderExpiryTime?: string | null; // ISO 8601 UTC timestamp
  orderMeta?: GatewayOrderMeta;
  orderNote?: string | null;
}

export type GatewayOrderStatus = "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "UNKNOWN";

export interface GatewayOrderResult {
  gatewayOrderId: string;    // Provider internal order identifier (e.g. Cashfree cf_order_id)
  merchantOrderId: string;   // Merchant order identifier (orderId)
  paymentSessionId: string;  // Transient client session token for checkout SDK
  orderStatus: GatewayOrderStatus;
  orderAmount: number;       // In currency units (Rupees, e.g. 2999.00)
  orderCurrency: string;     // E.g. "INR"
  orderExpiryTime?: string | null;
}

export type GatewayErrorCode =
  | "AUTHENTICATION_FAILED"
  | "GATEWAY_REJECTED"
  | "GATEWAY_TIMEOUT"
  | "NETWORK_ERROR"
  | "ORDER_ALREADY_EXISTS"
  | "IDEMPOTENCY_CONFLICT"
  | "MALFORMED_RESPONSE"
  | "GATEWAY_ERROR";

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly statusCode?: number;
  readonly providerCode?: string;
  readonly providerMessage?: string;
  readonly providerType?: string;

  constructor(
    message: string,
    options: {
      code: GatewayErrorCode;
      statusCode?: number;
      providerCode?: string;
      providerMessage?: string;
      providerType?: string;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "GatewayError";
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.providerCode = options.providerCode;
    this.providerMessage = options.providerMessage;
    this.providerType = options.providerType;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export interface IPaymentGatewayAdapter {
  /**
   * Initializes an order with the payment provider.
   * Returns normalized GatewayOrderResult containing the checkout session ID.
   */
  createOrder(params: CreateGatewayOrderParams): Promise<GatewayOrderResult>;

  /**
   * Retrieves an order by its merchant order identifier.
   * Returns null if the order does not exist (HTTP 404).
   */
  getOrder(orderId: string): Promise<GatewayOrderResult | null>;

  /**
   * Optional getter returning current gateway environment.
   */
  getEnvironment?(): "sandbox" | "production";
}

// ==============================================================================
// Provider-neutral contract for order-based gateways (Razorpay today).
//
// The legacy IPaymentGatewayAdapter above stays only for historical Cashfree
// records. New payment attempts use IOrderPaymentGateway. All amounts are integer
// paise; provider status strings are normalized here and never leak upward.
// ==============================================================================

export type ProviderOrderStatus = "created" | "attempted" | "paid";

export interface ProviderOrder {
  id: string;
  amountInPaise: number;
  currency: string;
  receipt: string | null;
  status: ProviderOrderStatus;
}

export type ProviderPaymentStatus = "created" | "authorized" | "captured" | "refunded" | "failed";

export interface ProviderPayment {
  id: string;
  orderId: string | null;
  amountInPaise: number;
  currency: string;
  status: ProviderPaymentStatus;
  method: string | null;
  bankReference: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  createdAt: string | null;
}

export type ProviderRefundStatus = "pending" | "processed" | "failed";

export interface ProviderRefund {
  id: string;
  paymentId: string;
  amountInPaise: number;
  status: ProviderRefundStatus;
  /** Eventsika payment_refunds.id echoed back from the provider's notes (notes.refund_id), when present. */
  localRefundId?: string | null;
}

export interface CreateProviderOrderParams {
  receipt: string;
  amountInPaise: number;
  currency: "INR";
  notes?: Record<string, string>;
}

export interface CreateProviderRefundParams {
  paymentId: string;
  amountInPaise: number;
  /** Stable per logical refund; retries must reuse it with an identical body. */
  idempotencyKey: string;
  notes?: Record<string, string>;
}

export interface IOrderPaymentGateway {
  readonly provider: "razorpay";
  createOrder(params: CreateProviderOrderParams): Promise<ProviderOrder>;
  fetchOrder(orderId: string): Promise<ProviderOrder | null>;
  /** Recovers an order whose creation response was lost. */
  findOrderByReceipt(receipt: string): Promise<ProviderOrder | null>;
  fetchOrderPayments(orderId: string): Promise<ProviderPayment[]>;
  fetchPayment(paymentId: string): Promise<ProviderPayment | null>;
  createRefund(params: CreateProviderRefundParams): Promise<ProviderRefund>;
  fetchRefund(refundId: string): Promise<ProviderRefund | null>;
  /** All refunds the provider holds for a payment: the authoritative lookup for refunds whose outcome is uncertain. */
  fetchPaymentRefunds(paymentId: string): Promise<ProviderRefund[]>;
}
