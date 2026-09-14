import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import {
  CreatePaymentOrderInput,
  PaymentOrderRecord,
  PaymentOrderStatus,
} from "../types/payment-and-consultation";
import { IPaymentOrderRepository } from "./payment-order-repository.interface";

export class SupabasePaymentOrderRepository implements IPaymentOrderRepository {
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

  private mapRowToRecord(row: Record<string, unknown>): PaymentOrderRecord {
    return {
      id: String(row.id),
      consultationId: String(row.consultation_id),
      gatewayOrderId: typeof row.gateway_order_id === "string" ? row.gateway_order_id : null,
      amountInPaise: Number(row.amount_in_paise),
      currency: (row.currency as "INR") || "INR",
      status: row.status as PaymentOrderStatus,
      expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
      paidAt: typeof row.paid_at === "string" ? row.paid_at : null,
      requestId: typeof row.request_id === "string" ? row.request_id : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async createOrder(order: CreatePaymentOrderInput): Promise<PaymentOrderRecord> {
    const client = this.getClient();

    if (!Number.isInteger(order.amountInPaise) || order.amountInPaise <= 0) {
      throw new Error("Order amount must be a strictly positive integer in paise.");
    }

    const { data, error } = await client
      .from("payment_orders")
      .insert({
        consultation_id: order.consultationId,
        gateway_order_id: order.gatewayOrderId || null,
        amount_in_paise: order.amountInPaise,
        currency: order.currency || "INR",
        status: "created",
        expires_at: order.expiresAt || null,
        request_id: order.requestId || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error creating payment order: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }

  async getOrderById(id: string): Promise<PaymentOrderRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from("payment_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching payment order: ${error.message}`);
    }

    return data ? this.mapRowToRecord(data) : null;
  }

  async getOrderByGatewayId(gatewayOrderId: string): Promise<PaymentOrderRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from("payment_orders")
      .select("*")
      .eq("gateway_order_id", gatewayOrderId)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching payment order by gateway ID: ${error.message}`);
    }

    return data ? this.mapRowToRecord(data) : null;
  }

  async updateOrderStatus(
    id: string,
    status: PaymentOrderStatus,
    details?: {
      gatewayOrderId?: string | null;
      paidAt?: string | null;
    }
  ): Promise<PaymentOrderRecord> {
    const client = this.getClient();
    const updates: Record<string, unknown> = { status };
    if (details?.gatewayOrderId !== undefined) {
      updates.gateway_order_id = details.gatewayOrderId;
    }
    if (details?.paidAt !== undefined) {
      updates.paid_at = details.paidAt;
    }

    const { data, error } = await client
      .from("payment_orders")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error updating payment order status: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }
}
