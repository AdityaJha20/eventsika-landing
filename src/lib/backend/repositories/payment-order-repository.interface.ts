import {
  CreatePaymentOrderInput,
  PaymentOrderRecord,
  PaymentOrderStatus,
  PaymentProvider,
} from "../types/payment-and-consultation";

export interface IPaymentOrderRepository {
  /**
   * Persists an internal payment order record.
   */
  createOrder(order: CreatePaymentOrderInput): Promise<PaymentOrderRecord>;

  /**
   * Retrieves an internal payment order by its primary ID.
   */
  getOrderById(id: string): Promise<PaymentOrderRecord | null>;

  /**
   * Retrieves an internal payment order by external provider order ID (legacy, any provider).
   */
  getOrderByGatewayId(gatewayOrderId: string): Promise<PaymentOrderRecord | null>;

  /**
   * Retrieves an order by provider-scoped gateway order ID.
   */
  getOrderByProviderGatewayId(provider: PaymentProvider, gatewayOrderId: string): Promise<PaymentOrderRecord | null>;

  /**
   * Retrieves an order by its stable internal receipt.
   */
  getOrderByReceipt(receipt: string): Promise<PaymentOrderRecord | null>;

  /**
   * Links a gateway order ID to a local order exactly once.
   */
  attachGatewayOrderId(id: string, gatewayOrderId: string): Promise<PaymentOrderRecord>;

  /**
   * Updates payment order status and optional settlement timestamps.
   * Status moves are additionally guarded by a database trigger (forward-only).
   */
  updateOrderStatus(
    id: string,
    status: PaymentOrderStatus,
    details?: {
      gatewayOrderId?: string | null;
      paidAt?: string | null;
    }
  ): Promise<PaymentOrderRecord>;

  /**
   * Retrieves the latest payment order associated with a consultation.
   */
  getLatestOrderByConsultationId(consultationId: string): Promise<PaymentOrderRecord | null>;

  /**
   * Lists unpaid (created/attempted) orders inside a creation window, oldest first.
   */
  listOpenOrders(
    provider: PaymentProvider,
    createdBefore: string,
    createdAfter: string,
    limit: number
  ): Promise<PaymentOrderRecord[]>;
}
