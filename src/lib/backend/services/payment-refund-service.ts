/**
 * Refund service (Razorpay; legacy Cashfree refunds become manual-review cases).
 *
 * Flow:
 *   1. Server-side eligibility (locked Eventsika policy, see evaluateRefundEligibility).
 *   2. create_payment_refund_intent RPC: locks the order, enforces the remaining
 *      refundable balance, persists the intent + audit row BEFORE any provider call.
 *   3. POST /v1/payments/{id}/refund with X-Refund-Idempotency = the intent's stable
 *      key and a body derived only from the stored intent (identical on retry).
 *   4. Provider acceptance => 'initiated' (refund_processing). Completion
 *      ('succeeded') is recorded ONLY from a verified refund webhook or an
 *      authoritative GET /v1/refunds/{id}.
 */

import crypto from "node:crypto";
import { logger } from "../logger/logger";
import {
  IPaymentLedgerRepository,
  RefundIntentRejectedError,
  SupabasePaymentLedgerRepository,
} from "../repositories/payment-ledger-repository";
import { IPaymentRefundRepository } from "../repositories/payment-refund-repository.interface";
import { SupabasePaymentRefundRepository } from "../repositories/supabase-payment-refund-repository";
import { IPaymentOrderRepository } from "../repositories/payment-order-repository.interface";
import { SupabasePaymentOrderRepository } from "../repositories/supabase-payment-order-repository";
import { IPaymentTransactionRepository } from "../repositories/payment-transaction-repository.interface";
import { SupabasePaymentTransactionRepository } from "../repositories/supabase-payment-transaction-repository";
import { IConsultationRepository } from "../repositories/consultation-repository.interface";
import { SupabaseConsultationRepository } from "../repositories/supabase-consultation-repository";
import { IConsultationSlotRepository } from "../repositories/consultation-slot-repository.interface";
import { SupabaseConsultationSlotRepository } from "../repositories/supabase-consultation-slot-repository";
import { GatewayError, IOrderPaymentGateway, ProviderRefund } from "../integrations/payment-gateway.interface";
import { RazorpayPaymentGateway } from "../integrations/razorpay-payment-gateway";
import { PaymentNotificationService, paymentNotificationService } from "./payment-notification-service";
import { ConsultationStatus, PaymentRefundRecord } from "../types/payment-and-consultation";

export const CUSTOMER_REFUND_CUTOFF_HOURS = 2;

/**
 * Why a refund is being issued. Each reason maps to a locked business rule.
 *  - customer_cancellation: refundable only until 2h before the consultation start.
 *  - eventsika_cancellation_alternative_rejected: Eventsika cancelled and the
 *    customer rejected the offered alternative -> full refund due.
 *  - duplicate_payment: an extra captured payment for an already-paid order.
 *  - goodwill: discretionary, explicit elevated decision (amount must be given).
 */
export type RefundReason =
  | "customer_cancellation"
  | "eventsika_cancellation_alternative_rejected"
  | "duplicate_payment"
  | "goodwill";

export interface RefundEligibilityInput {
  reason: RefundReason;
  consultationStatus: ConsultationStatus;
  slotStartIso: string | null;
  cancellationRequestedAt: Date;
}

export type RefundEligibility = { eligible: true } | { eligible: false; reason: string };

export function evaluateRefundEligibility(input: RefundEligibilityInput): RefundEligibility {
  if (input.consultationStatus === "no_show") {
    return { eligible: false, reason: "No-show consultations are not refundable." };
  }
  if (input.consultationStatus === "completed" && input.reason !== "duplicate_payment" && input.reason !== "goodwill") {
    return { eligible: false, reason: "Completed consultations are not refundable." };
  }
  switch (input.reason) {
    case "customer_cancellation": {
      if (!input.slotStartIso) {
        return { eligible: false, reason: "No scheduled slot to measure the cancellation cutoff against." };
      }
      const cutoff = new Date(input.slotStartIso).getTime() - CUSTOMER_REFUND_CUTOFF_HOURS * 3600_000;
      return input.cancellationRequestedAt.getTime() <= cutoff
        ? { eligible: true }
        : { eligible: false, reason: "Cancellations within 2 hours of the consultation are not refundable." };
    }
    case "eventsika_cancellation_alternative_rejected":
    case "duplicate_payment":
    case "goodwill":
      return { eligible: true };
    default:
      return { eligible: false, reason: "Unknown refund reason." };
  }
}

export type RefundRequestError =
  | "NOT_FOUND"
  | "NOT_ELIGIBLE"
  | "ORDER_NOT_PAID"
  | "TRANSACTION_NOT_REFUNDABLE"
  | "REFUND_EXCEEDS_BALANCE"
  | "MANUAL_REVIEW"
  | "DATABASE_ERROR";

export type RefundRequestResult =
  | { success: true; refund: PaymentRefundRecord; providerState: "initiated" | "pending_retry" | "manual_review" }
  | { success: false; error: RefundRequestError; message: string };

export interface RefundRequestInput {
  paymentOrderId: string;
  paymentTransactionId?: string | null;
  amountInPaise?: number | null; // omitted => full remaining balance
  reason: RefundReason;
  note: string;
  actorId: string;
  requestId: string;
  /** Client-generated per form submission so a double click maps to one refund. */
  clientRequestKey: string;
  cancellationRequestedAt?: Date;
}

export function buildRefundIdempotencyKey(paymentOrderId: string, clientRequestKey: string): string {
  // Stable for the same logical request; 'rf_' + 40 hex = 43 chars, within Razorpay's
  // documented alphabet (alphanumeric, '_' and '-') and length rules.
  return `rf_${crypto.createHash("sha256").update(`${paymentOrderId}:${clientRequestKey}`).digest("hex").slice(0, 40)}`;
}

export class PaymentRefundService {
  private ledger: IPaymentLedgerRepository;
  private refunds: IPaymentRefundRepository;
  private orders: IPaymentOrderRepository;
  private transactions: IPaymentTransactionRepository;
  private consultations: IConsultationRepository;
  private slots: IConsultationSlotRepository;
  private gateway: IOrderPaymentGateway;
  private notifications: Pick<PaymentNotificationService, "dispatch">;

  constructor(deps?: {
    ledger?: IPaymentLedgerRepository;
    refunds?: IPaymentRefundRepository;
    orders?: IPaymentOrderRepository;
    transactions?: IPaymentTransactionRepository;
    consultations?: IConsultationRepository;
    slots?: IConsultationSlotRepository;
    gateway?: IOrderPaymentGateway;
    notifications?: Pick<PaymentNotificationService, "dispatch">;
  }) {
    this.ledger = deps?.ledger || new SupabasePaymentLedgerRepository();
    this.refunds = deps?.refunds || new SupabasePaymentRefundRepository();
    this.orders = deps?.orders || new SupabasePaymentOrderRepository();
    this.transactions = deps?.transactions || new SupabasePaymentTransactionRepository();
    this.consultations = deps?.consultations || new SupabaseConsultationRepository();
    this.slots = deps?.slots || new SupabaseConsultationSlotRepository();
    this.gateway = deps?.gateway || new RazorpayPaymentGateway();
    this.notifications = deps?.notifications || paymentNotificationService;
  }

  async requestRefund(input: RefundRequestInput): Promise<RefundRequestResult> {
    const order = await this.orders.getOrderById(input.paymentOrderId);
    if (!order) return { success: false, error: "NOT_FOUND", message: "Payment order not found." };
    if (order.status !== "paid") return { success: false, error: "ORDER_NOT_PAID", message: "Only paid orders can be refunded." };

    const consultation = await this.consultations.getConsultationById(order.consultationId);
    if (!consultation) return { success: false, error: "NOT_FOUND", message: "Consultation not found." };
    const slot = consultation.slotId ? await this.slots.getSlotById(consultation.slotId) : null;

    const eligibility = evaluateRefundEligibility({
      reason: input.reason,
      consultationStatus: consultation.status,
      slotStartIso: slot?.startTime ?? null,
      cancellationRequestedAt: input.cancellationRequestedAt ?? new Date(),
    });
    if (!eligibility.eligible) {
      return { success: false, error: "NOT_ELIGIBLE", message: eligibility.reason };
    }

    const txns = await this.transactions.getTransactionsByOrderId(order.id);
    const captured = txns.filter((t) => t.status === "success");
    const txn = input.paymentTransactionId ? captured.find((t) => t.id === input.paymentTransactionId) : captured[0];
    if (!txn) return { success: false, error: "TRANSACTION_NOT_REFUNDABLE", message: "No captured payment to refund." };

    const existing = await this.refunds.getRefundsByOrderId(order.id);
    const committed = existing
      .filter((r) => r.paymentTransactionId === txn.id && r.status !== "failed")
      .reduce((sum, r) => sum + r.amountInPaise, 0);
    const amount = input.amountInPaise ?? txn.amountInPaise - committed;
    if (input.reason === "goodwill" && !input.amountInPaise) {
      return { success: false, error: "NOT_ELIGIBLE", message: "Goodwill refunds need an explicit amount." };
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return { success: false, error: "REFUND_EXCEEDS_BALANCE", message: "Nothing left to refund on this payment." };
    }

    let refund: PaymentRefundRecord;
    try {
      refund = await this.ledger.createRefundIntent({
        paymentOrderId: order.id,
        paymentTransactionId: txn.id,
        amountInPaise: amount,
        reason: `${input.reason}: ${input.note}`.slice(0, 100),
        initiatedBy: "admin",
        idempotencyKey: buildRefundIdempotencyKey(order.id, input.clientRequestKey),
        requestedBy: input.actorId,
        requestId: input.requestId,
      });
    } catch (err) {
      if (err instanceof RefundIntentRejectedError) {
        return { success: false, error: err.code === "ORDER_NOT_FOUND" ? "NOT_FOUND" : err.code, message: err.code };
      }
      logger.error("Refund intent creation failed", err, { orderId: order.id });
      return { success: false, error: "DATABASE_ERROR", message: "Refund could not be recorded." };
    }

    if (refund.provider !== "razorpay") {
      await this.ledger.recordIssue({
        provider: refund.provider,
        kind: "refund_manual_review",
        paymentOrderId: order.id,
        consultationId: order.consultationId,
        gatewayReference: refund.id,
        detail: "Legacy Cashfree refund must be issued manually in the Cashfree dashboard and then reconciled.",
      });
      return { success: true, refund, providerState: "manual_review" };
    }

    const submitted = await this.submitToProvider(refund);
    return { success: true, refund: submitted.refund, providerState: submitted.state };
  }

  /**
   * Sends (or re-sends) a pending refund intent with its stored idempotency key and
   * an identical body. Safe to call repeatedly from reconciliation.
   */
  async submitToProvider(
    refund: PaymentRefundRecord,
    options?: { verifyWithProviderFirst?: boolean }
  ): Promise<{ refund: PaymentRefundRecord; state: "initiated" | "pending_retry" | "manual_review" }> {
    if (refund.status !== "pending" || !refund.idempotencyKey || !refund.paymentTransactionId) {
      return { refund, state: refund.status === "initiated" ? "initiated" : "pending_retry" };
    }
    const txn = await this.transactions.getTransactionById(refund.paymentTransactionId);
    if (!txn?.gatewayPaymentId) {
      return { refund, state: "pending_retry" };
    }

    // An earlier attempt may have been accepted even though we never saw a clean
    // response. Ask Razorpay first (matched by notes.refund_id) before sending again,
    // so resubmission never depends solely on the provider's idempotency window.
    const priorAttempt = refund.lastError !== null || options?.verifyWithProviderFirst === true;
    if (priorAttempt) {
      let existing: ProviderRefund | undefined;
      try {
        existing = (await this.gateway.fetchPaymentRefunds(txn.gatewayPaymentId)).find(
          (r) => r.localRefundId === refund.id
        );
      } catch (err) {
        // Still uncertain: do not resubmit blind. Stay pending (balance stays reserved).
        logger.warn("Could not verify an uncertain refund with Razorpay; will retry", {
          refundId: refund.id,
          code: err instanceof GatewayError ? err.code : "UNKNOWN",
        });
        return { refund, state: "pending_retry" };
      }
      if (existing) {
        const updated = (await this.applyProviderRefund(existing, refund)) ?? refund;
        if (updated.status === "initiated" || updated.status === "succeeded") {
          await this.dispatchRefundProcessing(refund);
        }
        return { refund: updated, state: refundState(updated) };
      }
    }

    try {
      const remote = await this.gateway.createRefund({
        paymentId: txn.gatewayPaymentId,
        amountInPaise: refund.amountInPaise,
        idempotencyKey: refund.idempotencyKey,
        notes: { refund_id: refund.id },
      });
      const updated = await this.applyProviderRefund(remote, refund);
      await this.dispatchRefundProcessing(refund);
      return { refund: updated ?? refund, state: "initiated" };
    } catch (err) {
      const gw = err instanceof GatewayError ? err : null;
      const message = gw ? `${gw.code}${gw.providerMessage ? `: ${gw.providerMessage}` : ""}` : "unexpected error";
      logger.error("Razorpay refund submission did not complete", err, { refundId: refund.id, code: gw?.code });

      // Only an explicit business rejection of a FIRST attempt proves no refund exists.
      // Timeouts, network/5xx errors, idempotency conflicts, malformed or mismatched
      // responses, auth/config failures, and rejections of a resubmission (which could
      // be "already refunded") are all UNCERTAIN: the intent stays 'pending' with the
      // same idempotency key, keeps its balance reserved (no second refund), and is
      // resolved by provider lookup, webhook or reconciliation.
      const definitiveRejection = gw?.code === "GATEWAY_REJECTED" && !priorAttempt;
      if (!definitiveRejection) {
        await this.refunds.updateRefundStatus(refund.id, "pending", { lastError: message }).catch(() => undefined);
        const providerMayHaveAccepted = !gw || gw.code === "MALFORMED_RESPONSE" || gw.code === "GATEWAY_REJECTED";
        if (providerMayHaveAccepted) {
          await this.ledger
            .recordIssue({
              provider: "razorpay",
              kind: "refund_manual_review",
              paymentOrderId: refund.paymentOrderId,
              consultationId: refund.consultationId,
              gatewayReference: refund.id,
              detail: `Refund outcome uncertain (${message}); kept pending, do not refund again. Reconciliation will verify with Razorpay.`,
            })
            .catch((issueErr) => logger.error("Failed to record uncertain refund issue", issueErr, { refundId: refund.id }));
        }
        return { refund, state: "pending_retry" };
      }

      // Definitive rejection (e.g. partial refund unsupported for the method, payment
      // older than the refund window): fail the intent, releasing its balance, and
      // hand it to an administrator.
      const failed = await this.refunds.updateRefundStatus(refund.id, "failed", { lastError: message }).catch(() => refund);
      await this.ledger.recordIssue({
        provider: "razorpay",
        kind: "refund_manual_review",
        paymentOrderId: refund.paymentOrderId,
        consultationId: refund.consultationId,
        gatewayReference: refund.id,
        detail: `Razorpay rejected the refund: ${message}`,
      });
      return { refund: failed, state: "manual_review" };
    }
  }

  /**
   * Applies authoritative provider refund state (from API response, verified webhook
   * or GET /v1/refunds/{id}). Status only moves forward (DB trigger enforced).
   * Returns null when the refund is not one Eventsika requested.
   */
  private async dispatchRefundProcessing(refund: PaymentRefundRecord): Promise<void> {
    await this.notifications.dispatch({
      kind: "refund_processing",
      dedupeKey: `refund_processing:${refund.id}`,
      consultationId: refund.consultationId,
      paymentOrderId: refund.paymentOrderId,
      refundId: refund.id,
    });
  }

  async applyProviderRefund(remote: ProviderRefund, known?: PaymentRefundRecord): Promise<PaymentRefundRecord | null> {
    let local = known ?? (await this.refunds.getRefundByGatewayId(remote.id));
    if (!local && remote.localRefundId) {
      // Our own refund id echoed back in notes: the strongest link for a refund whose
      // creation response was lost. Accept it only if payment and amount also agree.
      const candidate = await this.refunds.getRefundById(remote.localRefundId);
      const candidateTxn = candidate?.paymentTransactionId
        ? await this.transactions.getTransactionById(candidate.paymentTransactionId)
        : null;
      if (candidate && candidateTxn?.gatewayPaymentId === remote.paymentId) {
        if (candidate.amountInPaise !== remote.amountInPaise) {
          await this.ledger.recordIssue({
            provider: candidate.provider,
            kind: "refund_manual_review",
            paymentOrderId: candidate.paymentOrderId,
            consultationId: candidate.consultationId,
            gatewayReference: remote.id,
            detail: `Provider refund amount ${remote.amountInPaise} differs from intent ${candidate.amountInPaise} paise.`,
          });
          return candidate;
        }
        if (!candidate.gatewayRefundId || candidate.gatewayRefundId === remote.id) local = candidate;
      }
    }
    if (!local) {
      // Created by us but the response was lost: match by payment + notes is not
      // available in the entity, so match a pending intent on the same payment/amount.
      const txn = await this.transactions.getTransactionByGatewayId(remote.paymentId);
      if (txn) {
        const candidates = (await this.refunds.getRefundsByOrderId(txn.paymentOrderId)).filter(
          (r) => r.status === "pending" && !r.gatewayRefundId && r.amountInPaise === remote.amountInPaise && r.paymentTransactionId === txn.id
        );
        local = candidates.length === 1 ? candidates[0] : null;
      }
    }
    if (!local) return null;

    const target = remote.status === "processed" ? "succeeded" : remote.status === "failed" ? "failed" : "initiated";
    if (local.status === target || local.status === "succeeded" || local.status === "failed") {
      if (!local.gatewayRefundId) {
        return this.refunds.updateRefundStatus(local.id, local.status, { gatewayRefundId: remote.id });
      }
      return local;
    }

    const updated = await this.refunds.updateRefundStatus(local.id, target, {
      gatewayRefundId: local.gatewayRefundId ?? remote.id,
      processedAt: target === "succeeded" ? new Date().toISOString() : undefined,
    });
    await this.ledger
      .appendAudit({
        actorType: "provider",
        action: "refund_status_changed",
        entityType: "refund",
        entityId: local.id,
        oldState: local.status,
        newState: target,
        metadata: { gateway_refund_id: remote.id },
      })
      .catch((err) => logger.error("Failed to audit refund status change", err, { refundId: local!.id }));

    if (target === "succeeded") {
      await this.notifications.dispatch({
        kind: "refund_processed",
        dedupeKey: `refund_processed:${local.id}`,
        consultationId: local.consultationId,
        paymentOrderId: local.paymentOrderId,
        refundId: local.id,
      });
    } else if (target === "failed") {
      await this.ledger.recordIssue({
        provider: local.provider,
        kind: "refund_failed",
        paymentOrderId: local.paymentOrderId,
        consultationId: local.consultationId,
        gatewayReference: remote.id,
        detail: "Provider reported the refund as failed.",
      });
    }
    return updated;
  }

  /** Reconciliation: resubmit pending intents and poll initiated refunds. */
  async reconcileOpenRefunds(limit = 25): Promise<{ resubmitted: number; updated: number; errors: number }> {
    const counts = { resubmitted: 0, updated: 0, errors: 0 };
    const open = await this.refunds.listOpenRefunds("razorpay", limit);
    for (const refund of open) {
      try {
        if (refund.status === "pending") {
          // Reconciliation always verifies with Razorpay before resending.
          await this.submitToProvider(refund, { verifyWithProviderFirst: true });
          counts.resubmitted++;
        } else if (refund.gatewayRefundId) {
          const remote = await this.gateway.fetchRefund(refund.gatewayRefundId);
          if (remote && (await this.applyProviderRefund(remote, refund))?.status !== refund.status) counts.updated++;
        }
      } catch (err) {
        counts.errors++;
        logger.error("Refund reconciliation failed", err, { refundId: refund.id });
      }
    }
    return counts;
  }
}

function refundState(refund: PaymentRefundRecord): "initiated" | "pending_retry" | "manual_review" {
  if (refund.status === "initiated" || refund.status === "succeeded") return "initiated";
  if (refund.status === "failed") return "manual_review";
  return "pending_retry";
}

export const paymentRefundService = new PaymentRefundService();
