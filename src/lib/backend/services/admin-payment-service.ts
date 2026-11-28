/**
 * Read model for the /admin payments workspace (operational visibility only).
 * Writes go through PaymentRefundService / ledger RPCs behind the finance-admin guard.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import { logger } from "../logger/logger";
import { IPaymentLedgerRepository, SupabasePaymentLedgerRepository } from "../repositories/payment-ledger-repository";
import { PaymentIssueRecord } from "../types/payment-and-consultation";

export interface AdminPaymentRow {
  orderId: string;
  provider: string;
  receipt: string | null;
  gatewayOrderId: string | null;
  orderStatus: string;
  amountInPaise: number;
  createdAt: string;
  paidAt: string | null;
  customerName: string;
  customerEmail: string;
  consultationId: string;
  consultationStatus: string;
  slotStartTime: string | null;
  transactions: Array<{ id: string; gatewayPaymentId: string | null; status: string; amountInPaise: number; method: string | null }>;
  refunds: Array<{ id: string; status: string; amountInPaise: number; reason: string; gatewayRefundId: string | null; createdAt: string }>;
  refundableInPaise: number;
}

export interface AdminPaymentOverview {
  payments: AdminPaymentRow[];
  openIssues: PaymentIssueRecord[];
  failedNotifications: number;
}

type Row = Record<string, unknown>;

function one(value: unknown): Row | null {
  if (Array.isArray(value)) return (value[0] as Row) ?? null;
  return value && typeof value === "object" ? (value as Row) : null;
}

export function mapAdminPaymentRow(row: Row): AdminPaymentRow {
  const consultation = one(row.consultations);
  const slot = one(consultation?.consultation_slots);
  const txns = (Array.isArray(row.payment_transactions) ? row.payment_transactions : []) as Row[];
  const refunds = (Array.isArray(row.payment_refunds) ? row.payment_refunds : []) as Row[];
  const captured = txns.find((t) => t.status === "success");
  const committed = refunds
    .filter((r) => r.status !== "failed" && (!captured || r.payment_transaction_id === captured.id))
    .reduce((s, r) => s + Number(r.amount_in_paise), 0);
  return {
    orderId: String(row.id),
    provider: String(row.provider),
    receipt: typeof row.receipt === "string" ? row.receipt : null,
    gatewayOrderId: typeof row.gateway_order_id === "string" ? row.gateway_order_id : null,
    orderStatus: String(row.status),
    amountInPaise: Number(row.amount_in_paise),
    createdAt: String(row.created_at),
    paidAt: typeof row.paid_at === "string" ? row.paid_at : null,
    customerName: consultation ? `${consultation.customer_first_name ?? ""} ${consultation.customer_last_name ?? ""}`.trim() : "",
    customerEmail: consultation ? String(consultation.customer_email ?? "") : "",
    consultationId: String(row.consultation_id),
    consultationStatus: consultation ? String(consultation.status) : "unknown",
    slotStartTime: slot && typeof slot.start_time === "string" ? slot.start_time : null,
    transactions: txns.map((t) => ({
      id: String(t.id),
      gatewayPaymentId: typeof t.gateway_payment_id === "string" ? t.gateway_payment_id : null,
      status: String(t.status),
      amountInPaise: Number(t.amount_in_paise),
      method: typeof t.payment_method === "string" ? t.payment_method : null,
    })),
    refunds: refunds.map((r) => ({
      id: String(r.id),
      status: String(r.status),
      amountInPaise: Number(r.amount_in_paise),
      reason: String(r.reason ?? ""),
      gatewayRefundId: typeof r.gateway_refund_id === "string" ? r.gateway_refund_id : null,
      createdAt: String(r.created_at),
    })),
    refundableInPaise: captured ? Math.max(0, Number(captured.amount_in_paise) - committed) : 0,
  };
}

export class AdminPaymentService {
  private client: SupabaseClient | null;
  private ledger: IPaymentLedgerRepository;

  constructor(deps?: { client?: SupabaseClient | null; ledger?: IPaymentLedgerRepository }) {
    this.client = deps?.client !== undefined ? deps.client : getSupabaseAdminClient();
    this.ledger = deps?.ledger || new SupabasePaymentLedgerRepository();
  }

  async getOverview(limit = 100): Promise<{ success: true; data: AdminPaymentOverview } | { success: false; error: string }> {
    const client = this.client || getSupabaseAdminClient();
    if (!client) return { success: false, error: "Database is not configured." };
    try {
      const { data, error } = await client
        .from("payment_orders")
        .select(
          "id, provider, receipt, gateway_order_id, status, amount_in_paise, created_at, paid_at, consultation_id, " +
            "consultations(customer_first_name, customer_last_name, customer_email, status, consultation_slots(start_time)), " +
            "payment_transactions(id, gateway_payment_id, status, amount_in_paise, payment_method), " +
            "payment_refunds(id, status, amount_in_paise, reason, gateway_refund_id, payment_transaction_id, created_at)"
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);

      const [openIssues, failed] = await Promise.all([
        this.ledger.listOpenIssues(100),
        client.from("payment_notifications").select("id", { count: "exact", head: true }).eq("status", "failed"),
      ]);

      return {
        success: true,
        data: {
          payments: ((data ?? []) as unknown as Row[]).map(mapAdminPaymentRow),
          openIssues,
          failedNotifications: failed.count ?? 0,
        },
      };
    } catch (err) {
      logger.error("Admin payment overview failed", err);
      return { success: false, error: "Payments could not be loaded right now." };
    }
  }
}

export const adminPaymentService = new AdminPaymentService();
