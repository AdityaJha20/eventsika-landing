import {
  CreatePaymentOrderInput,
  PaymentOrderRecord,
  PaymentOrderStatus,
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
   * Retrieves an internal payment order by external provider order ID.
   */
  getOrderByGatewayId(gatewayOrderId: string): Promise<PaymentOrderRecord | null>;

  /**
   * Updates payment order status and optional settlement timestamps.
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
}
