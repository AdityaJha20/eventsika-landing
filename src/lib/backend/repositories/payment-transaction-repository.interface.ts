import {
  CreatePaymentTransactionInput,
  PaymentTransactionRecord,
} from "../types/payment-and-consultation";

export interface IPaymentTransactionRepository {
  /**
   * Appends an immutable payment transaction record.
   */
  recordTransaction(transaction: CreatePaymentTransactionInput): Promise<PaymentTransactionRecord>;

  /**
   * Retrieves a payment transaction by primary ID.
   */
  getTransactionById(id: string): Promise<PaymentTransactionRecord | null>;

  /**
   * Retrieves a payment transaction by external gateway payment ID.
   */
  getTransactionByGatewayId(gatewayPaymentId: string): Promise<PaymentTransactionRecord | null>;

  /**
   * Retrieves all transactions associated with a payment order.
   */
  getTransactionsByOrderId(orderId: string): Promise<PaymentTransactionRecord[]>;
}
