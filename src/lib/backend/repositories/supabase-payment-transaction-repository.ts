import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import {
  CreatePaymentTransactionInput,
  PaymentMethod,
  PaymentTransactionRecord,
  PaymentTransactionStatus,
} from "../types/payment-and-consultation";
import { IPaymentTransactionRepository } from "./payment-transaction-repository.interface";

export class SupabasePaymentTransactionRepository implements IPaymentTransactionRepository {
  private client: SupabaseClient | null;

  constructor(client?: SupabaseClient | null) {
    this.client = client !== undefined ? client : getSupabaseAdminClient();
  }

  private getClient(): SupabaseClient {
    const client = this.client || getSupabaseAdminClient();
    if (!client) {
      throw new Error("Supabase client is not configured or unavailable.");
    }
    return client;
  }

  private mapRowToRecord(row: Record<string, unknown>): PaymentTransactionRecord {
    return {
      id: String(row.id),
      paymentOrderId: String(row.payment_order_id),
      gatewayPaymentId: typeof row.gateway_payment_id === "string" ? row.gateway_payment_id : null,
      amountInPaise: Number(row.amount_in_paise),
      feeInPaise: row.fee_in_paise !== null && row.fee_in_paise !== undefined ? Number(row.fee_in_paise) : null,
      taxInPaise: row.tax_in_paise !== null && row.tax_in_paise !== undefined ? Number(row.tax_in_paise) : null,
      status: row.status as PaymentTransactionStatus,
      paymentMethod: typeof row.payment_method === "string" ? (row.payment_method as PaymentMethod) : null,
      bankReference: typeof row.bank_reference === "string" ? row.bank_reference : null,
      errorCode: typeof row.error_code === "string" ? row.error_code : null,
      errorDescription: typeof row.error_description === "string" ? row.error_description : null,
      createdAt: String(row.created_at),
    };
  }

  async recordTransaction(transaction: CreatePaymentTransactionInput): Promise<PaymentTransactionRecord> {
    const client = this.getClient();

    if (!Number.isInteger(transaction.amountInPaise) || transaction.amountInPaise <= 0) {
      throw new Error("Transaction amount must be a strictly positive integer in paise.");
    }

    const { data, error } = await client
      .from("payment_transactions")
      .insert({
        payment_order_id: transaction.paymentOrderId,
        gateway_payment_id: transaction.gatewayPaymentId || null,
        amount_in_paise: transaction.amountInPaise,
        fee_in_paise: transaction.feeInPaise || null,
        tax_in_paise: transaction.taxInPaise || null,
        status: transaction.status || "pending",
        payment_method: transaction.paymentMethod || null,
        bank_reference: transaction.bankReference || null,
        error_code: transaction.errorCode || null,
        error_description: transaction.errorDescription || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error recording payment transaction: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }

  async getTransactionById(id: string): Promise<PaymentTransactionRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from("payment_transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching payment transaction: ${error.message}`);
    }

    return data ? this.mapRowToRecord(data) : null;
  }

  async getTransactionByGatewayId(gatewayPaymentId: string): Promise<PaymentTransactionRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from("payment_transactions")
      .select("*")
      .eq("gateway_payment_id", gatewayPaymentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching payment transaction by gateway ID: ${error.message}`);
    }

    return data ? this.mapRowToRecord(data) : null;
  }

  async getTransactionsByOrderId(orderId: string): Promise<PaymentTransactionRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from("payment_transactions")
      .select("*")
      .eq("payment_order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Database error querying payment transactions for order: ${error.message}`);
    }

    return (data || []).map((row) => this.mapRowToRecord(row));
  }
}
