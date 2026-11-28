import {
  CreatePaymentRefundInput,
  PaymentRefundRecord,
  PaymentRefundStatus,
} from "../types/payment-and-consultation";

export interface IPaymentRefundRepository {
  /**
   * Persists a payment refund record.
   */
  createRefund(refund: CreatePaymentRefundInput): Promise<PaymentRefundRecord>;

  /**
   * Retrieves a refund record by primary ID.
   */
  getRefundById(id: string): Promise<PaymentRefundRecord | null>;

  /**
   * Retrieves all refunds associated with a payment order.
   */
  getRefundsByOrderId(orderId: string): Promise<PaymentRefundRecord[]>;

  /**
   * Updates refund status and optional gateway reference.
   */
  updateRefundStatus(
    id: string,
    status: PaymentRefundStatus,
    details?: {
      gatewayRefundId?: string | null;
      processedAt?: string | null;
      lastError?: string | null;
    }
  ): Promise<PaymentRefundRecord>;

  /**
   * Retrieves a refund by provider refund ID.
   */
  getRefundByGatewayId(gatewayRefundId: string): Promise<PaymentRefundRecord | null>;

  /**
   * Pending / initiated refunds for a provider, oldest first.
   */
  listOpenRefunds(provider: PaymentRefundRecord["provider"], limit: number): Promise<PaymentRefundRecord[]>;
}
