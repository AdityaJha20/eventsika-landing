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
}
