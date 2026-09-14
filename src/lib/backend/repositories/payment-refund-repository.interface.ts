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
    }
  ): Promise<PaymentRefundRecord>;
}
