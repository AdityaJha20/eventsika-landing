import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import {
  CreatePaymentRefundInput,
  PaymentRefundRecord,
  PaymentRefundStatus,
  RefundInitiator,
} from "../types/payment-and-consultation";
import { IPaymentRefundRepository } from "./payment-refund-repository.interface";

export class SupabasePaymentRefundRepository implements IPaymentRefundRepository {
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

  private mapRowToRecord(row: Record<string, unknown>): PaymentRefundRecord {
    return {
      id: String(row.id),
      paymentOrderId: String(row.payment_order_id),
      paymentTransactionId: typeof row.payment_transaction_id === "string" ? row.payment_transaction_id : null,
      consultationId: String(row.consultation_id),
      gatewayRefundId: typeof row.gateway_refund_id === "string" ? row.gateway_refund_id : null,
      amountInPaise: Number(row.amount_in_paise),
      status: row.status as PaymentRefundStatus,
      reason: String(row.reason ?? ""),
      initiatedBy: row.initiated_by as RefundInitiator,
      processedAt: typeof row.processed_at === "string" ? row.processed_at : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async createRefund(refund: CreatePaymentRefundInput): Promise<PaymentRefundRecord> {
    const client = this.getClient();

    if (!Number.isInteger(refund.amountInPaise) || refund.amountInPaise <= 0) {
      throw new Error("Refund amount must be a strictly positive integer in paise.");
    }

    const { data, error } = await client
      .from("payment_refunds")
      .insert({
        payment_order_id: refund.paymentOrderId,
        payment_transaction_id: refund.paymentTransactionId || null,
        consultation_id: refund.consultationId,
        gateway_refund_id: refund.gatewayRefundId || null,
        amount_in_paise: refund.amountInPaise,
        status: "pending",
        reason: refund.reason,
        initiated_by: refund.initiatedBy,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error creating payment refund: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }

  async getRefundById(id: string): Promise<PaymentRefundRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from("payment_refunds")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching payment refund: ${error.message}`);
    }

    return data ? this.mapRowToRecord(data) : null;
  }

  async getRefundsByOrderId(orderId: string): Promise<PaymentRefundRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from("payment_refunds")
      .select("*")
      .eq("payment_order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Database error querying payment refunds for order: ${error.message}`);
    }

    return (data || []).map((row) => this.mapRowToRecord(row));
  }

  async updateRefundStatus(
    id: string,
    status: PaymentRefundStatus,
    details?: {
      gatewayRefundId?: string | null;
      processedAt?: string | null;
    }
  ): Promise<PaymentRefundRecord> {
    const client = this.getClient();
    const updates: Record<string, unknown> = { status };
    if (details?.gatewayRefundId !== undefined) {
      updates.gateway_refund_id = details.gatewayRefundId;
    }
    if (details?.processedAt !== undefined) {
      updates.processed_at = details.processedAt;
    }

    const { data, error } = await client
      .from("payment_refunds")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error updating payment refund status: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }
}
