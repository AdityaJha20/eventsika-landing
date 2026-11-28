/**
 * Payment ledger repository: thin wrappers over the transactional RPCs and the
 * issue / notification / audit tables added by
 * 20261126120000_add_razorpay_payment_gateway_support.sql.
 *
 * Every concurrency-sensitive decision (payment + booking, refund balance, slot
 * re-booking, notification claim) happens inside one PostgreSQL transaction.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import {
  CreateAuditLogInput,
  CreatePaymentIssueInput,
  PaymentIssueKind,
  PaymentIssueRecord,
  PaymentNotificationKind,
  PaymentProvider,
  PaymentRefundRecord,
  RefundInitiator,
} from "../types/payment-and-consultation";

export type LedgerPaymentStatus = "authorized" | "captured" | "failed" | "user_dropped";

export type ApplyPaymentOutcome =
  | "order_not_found"
  | "amount_mismatch"
  | "currency_mismatch"
  | "payment_pending"
  | "payment_failed"
  | "user_dropped"
  | "confirmed"
  | "already_confirmed"
  | "slot_conflict"
  | "duplicate_payment"
  | "paid_inactive_consultation";

export interface ApplyPaymentEventParams {
  paymentOrderId: string;
  gatewayPaymentId: string | null;
  status: LedgerPaymentStatus;
  amountInPaise: number;
  currency: string;
  paymentMethod?: string | null;
  bankReference?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
  eventTime?: string | null;
}

export interface ApplyPaymentEventResult {
  outcome: ApplyPaymentOutcome;
  paymentOrderId: string | null;
  consultationId: string | null;
  transactionId: string | null;
  orderStatus: string | null;
}

export type RefundIntentError =
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_PAID"
  | "TRANSACTION_NOT_REFUNDABLE"
  | "REFUND_EXCEEDS_BALANCE";

export class RefundIntentRejectedError extends Error {
  constructor(readonly code: RefundIntentError) {
    super(code);
    this.name = "RefundIntentRejectedError";
  }
}

export type RebookResult = "rebooked" | "not_found" | "not_in_conflict" | "not_paid" | "slot_unavailable";

export interface ClaimedNotification {
  id: string;
  dedupeKey: string;
  kind: PaymentNotificationKind;
  attempts: number;
}

export interface IPaymentLedgerRepository {
  applyPaymentEvent(params: ApplyPaymentEventParams): Promise<ApplyPaymentEventResult>;
  createRefundIntent(params: {
    paymentOrderId: string;
    paymentTransactionId: string;
    amountInPaise: number;
    reason: string;
    initiatedBy: RefundInitiator;
    idempotencyKey: string;
    requestedBy: string | null;
    requestId: string | null;
  }): Promise<PaymentRefundRecord>;
  rebookConflictedConsultation(consultationId: string, newSlotId: string): Promise<RebookResult>;
  claimNotification(params: {
    dedupeKey: string;
    kind: PaymentNotificationKind;
    consultationId: string;
    paymentOrderId?: string | null;
    refundId?: string | null;
  }): Promise<ClaimedNotification | null>;
  completeNotification(id: string, outcome: { sent: boolean; error?: string | null; providerMessageId?: string | null }): Promise<void>;
  listRetryableNotifications(limit: number): Promise<
    Array<{ dedupeKey: string; kind: PaymentNotificationKind; consultationId: string; paymentOrderId: string | null; refundId: string | null }>
  >;
  recordIssue(issue: CreatePaymentIssueInput): Promise<void>;
  resolveIssue(id: string, resolvedBy: string, note: string): Promise<PaymentIssueRecord | null>;
  listOpenIssues(limit: number): Promise<PaymentIssueRecord[]>;
  appendAudit(entry: CreateAuditLogInput): Promise<void>;
}

const ISSUE_COLUMNS =
  "id, provider, payment_order_id, consultation_id, kind, gateway_reference, detail, resolved_at, resolved_by, resolution_note, created_at";

export class SupabasePaymentLedgerRepository implements IPaymentLedgerRepository {
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

  async applyPaymentEvent(params: ApplyPaymentEventParams): Promise<ApplyPaymentEventResult> {
    const { data, error } = await this.getClient().rpc("apply_payment_event", {
      p_payment_order_id: params.paymentOrderId,
      p_gateway_payment_id: params.gatewayPaymentId,
      p_status: params.status,
      p_amount_in_paise: params.amountInPaise,
      p_currency: params.currency,
      p_payment_method: params.paymentMethod ?? null,
      p_bank_reference: params.bankReference ?? null,
      p_error_code: params.errorCode ?? null,
      p_error_description: params.errorDescription ?? null,
      p_event_time: params.eventTime ?? null,
    });
    if (error) {
      throw new Error(`Database error applying payment event: ${error.message}`);
    }
    const row = (data ?? {}) as Record<string, unknown>;
    if (typeof row.outcome !== "string") {
      throw new Error("apply_payment_event returned no outcome");
    }
    return {
      outcome: row.outcome as ApplyPaymentOutcome,
      paymentOrderId: typeof row.payment_order_id === "string" ? row.payment_order_id : null,
      consultationId: typeof row.consultation_id === "string" ? row.consultation_id : null,
      transactionId: typeof row.transaction_id === "string" ? row.transaction_id : null,
      orderStatus: typeof row.order_status === "string" ? row.order_status : null,
    };
  }

  async createRefundIntent(params: {
    paymentOrderId: string;
    paymentTransactionId: string;
    amountInPaise: number;
    reason: string;
    initiatedBy: RefundInitiator;
    idempotencyKey: string;
    requestedBy: string | null;
    requestId: string | null;
  }): Promise<PaymentRefundRecord> {
    const { data, error } = await this.getClient().rpc("create_payment_refund_intent", {
      p_payment_order_id: params.paymentOrderId,
      p_payment_transaction_id: params.paymentTransactionId,
      p_amount_in_paise: params.amountInPaise,
      p_reason: params.reason,
      p_initiated_by: params.initiatedBy,
      p_idempotency_key: params.idempotencyKey,
      p_requested_by: params.requestedBy,
      p_request_id: params.requestId,
    });
    if (error) {
      const known: RefundIntentError[] = [
        "ORDER_NOT_FOUND",
        "ORDER_NOT_PAID",
        "TRANSACTION_NOT_REFUNDABLE",
        "REFUND_EXCEEDS_BALANCE",
      ];
      const code = known.find((k) => error.message?.includes(k));
      if (code) throw new RefundIntentRejectedError(code);
      throw new Error(`Database error creating refund intent: ${error.message}`);
    }
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!row || typeof row.id !== "string") {
      throw new Error("create_payment_refund_intent returned no row");
    }
    return mapRefundRow(row);
  }

  async rebookConflictedConsultation(consultationId: string, newSlotId: string): Promise<RebookResult> {
    const { data, error } = await this.getClient().rpc("rebook_conflicted_consultation", {
      p_consultation_id: consultationId,
      p_new_slot_id: newSlotId,
    });
    if (error) {
      throw new Error(`Database error rebooking consultation: ${error.message}`);
    }
    return data as RebookResult;
  }

  async claimNotification(params: {
    dedupeKey: string;
    kind: PaymentNotificationKind;
    consultationId: string;
    paymentOrderId?: string | null;
    refundId?: string | null;
  }): Promise<ClaimedNotification | null> {
    const { data, error } = await this.getClient().rpc("claim_payment_notification", {
      p_dedupe_key: params.dedupeKey,
      p_kind: params.kind,
      p_consultation_id: params.consultationId,
      p_payment_order_id: params.paymentOrderId ?? null,
      p_refund_id: params.refundId ?? null,
    });
    if (error) {
      throw new Error(`Database error claiming notification: ${error.message}`);
    }
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!row || typeof row.id !== "string") return null;
    return {
      id: row.id,
      dedupeKey: String(row.dedupe_key),
      kind: row.kind as PaymentNotificationKind,
      attempts: Number(row.attempts ?? 0),
    };
  }

  async completeNotification(
    id: string,
    outcome: { sent: boolean; error?: string | null; providerMessageId?: string | null }
  ): Promise<void> {
    const { error } = await this.getClient()
      .from("payment_notifications")
      .update(
        outcome.sent
          ? { status: "sent", sent_at: new Date().toISOString(), locked_until: null, last_error: null, provider_message_id: outcome.providerMessageId ?? null }
          : { status: "failed", locked_until: null, last_error: (outcome.error ?? "unknown").slice(0, 500) }
      )
      .eq("id", id);
    if (error) {
      throw new Error(`Database error completing notification: ${error.message}`);
    }
  }

  async listRetryableNotifications(limit: number) {
    const { data, error } = await this.getClient()
      .from("payment_notifications")
      .select("dedupe_key, kind, consultation_id, payment_order_id, refund_id")
      .in("status", ["pending", "failed"])
      .lt("attempts", 8)
      .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) {
      throw new Error(`Database error listing notifications: ${error.message}`);
    }
    return (data || []).map((r) => ({
      dedupeKey: String(r.dedupe_key),
      kind: r.kind as PaymentNotificationKind,
      consultationId: String(r.consultation_id),
      paymentOrderId: typeof r.payment_order_id === "string" ? r.payment_order_id : null,
      refundId: typeof r.refund_id === "string" ? r.refund_id : null,
    }));
  }

  async recordIssue(issue: CreatePaymentIssueInput): Promise<void> {
    const { error } = await this.getClient().from("payment_issues").insert({
      provider: issue.provider,
      kind: issue.kind,
      payment_order_id: issue.paymentOrderId ?? null,
      consultation_id: issue.consultationId ?? null,
      gateway_reference: issue.gatewayReference ?? null,
      detail: issue.detail?.slice(0, 1000) ?? null,
    });
    // 23505: an identical open issue already exists, which is the desired idempotency.
    if (error && error.code !== "23505") {
      throw new Error(`Database error recording payment issue: ${error.message}`);
    }
  }

  async resolveIssue(id: string, resolvedBy: string, note: string): Promise<PaymentIssueRecord | null> {
    const { data, error } = await this.getClient()
      .from("payment_issues")
      .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy, resolution_note: note.slice(0, 1000) })
      .eq("id", id)
      .is("resolved_at", null)
      .select(ISSUE_COLUMNS)
      .maybeSingle();
    if (error) {
      throw new Error(`Database error resolving payment issue: ${error.message}`);
    }
    return data ? mapIssueRow(data) : null;
  }

  async listOpenIssues(limit: number): Promise<PaymentIssueRecord[]> {
    const { data, error } = await this.getClient()
      .from("payment_issues")
      .select(ISSUE_COLUMNS)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      throw new Error(`Database error listing payment issues: ${error.message}`);
    }
    return (data || []).map(mapIssueRow);
  }

  async appendAudit(entry: CreateAuditLogInput): Promise<void> {
    const { error } = await this.getClient().from("payment_audit_log").insert({
      actor_type: entry.actorType,
      actor_id: entry.actorId ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      old_state: entry.oldState ?? null,
      new_state: entry.newState ?? null,
      reason: entry.reason ?? null,
      request_id: entry.requestId ?? null,
      metadata: entry.metadata ?? null,
    });
    if (error) {
      throw new Error(`Database error appending audit log: ${error.message}`);
    }
  }
}

function mapIssueRow(row: Record<string, unknown>): PaymentIssueRecord {
  return {
    id: String(row.id),
    provider: row.provider as PaymentProvider,
    paymentOrderId: typeof row.payment_order_id === "string" ? row.payment_order_id : null,
    consultationId: typeof row.consultation_id === "string" ? row.consultation_id : null,
    kind: row.kind as PaymentIssueKind,
    gatewayReference: typeof row.gateway_reference === "string" ? row.gateway_reference : null,
    detail: typeof row.detail === "string" ? row.detail : null,
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
    resolvedBy: typeof row.resolved_by === "string" ? row.resolved_by : null,
    resolutionNote: typeof row.resolution_note === "string" ? row.resolution_note : null,
    createdAt: String(row.created_at),
  };
}

export function mapRefundRow(row: Record<string, unknown>): PaymentRefundRecord {
  return {
    id: String(row.id),
    paymentOrderId: String(row.payment_order_id),
    paymentTransactionId: typeof row.payment_transaction_id === "string" ? row.payment_transaction_id : null,
    consultationId: String(row.consultation_id),
    provider: (row.provider as PaymentProvider) || "cashfree",
    gatewayRefundId: typeof row.gateway_refund_id === "string" ? row.gateway_refund_id : null,
    idempotencyKey: typeof row.idempotency_key === "string" ? row.idempotency_key : null,
    lastError: typeof row.last_error === "string" ? row.last_error : null,
    requestedBy: typeof row.requested_by === "string" ? row.requested_by : null,
    requestId: typeof row.request_id === "string" ? row.request_id : null,
    amountInPaise: Number(row.amount_in_paise),
    status: row.status as PaymentRefundRecord["status"],
    reason: String(row.reason ?? ""),
    initiatedBy: row.initiated_by as RefundInitiator,
    processedAt: typeof row.processed_at === "string" ? row.processed_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
