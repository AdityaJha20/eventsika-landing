/**
 * Payment reconciliation (repeatable, idempotent, never "corrects" money by itself).
 *
 * Each run:
 *   1. Re-processes Razorpay webhook events stuck in received/failed after their
 *      lease expired (crash recovery for the ack path).
 *   2. Cross-checks unpaid Razorpay orders against GET /v1/orders/{id}/payments
 *      (missed webhooks; captured-at-Razorpay-but-pending-here) and recovers orders
 *      whose creation response was lost (lookup by receipt).
 *   3. Flags payments authorized but not captured for too long.
 *   4. Resubmits pending refund intents (same idempotency key) and polls initiated
 *      refunds for completion.
 *   5. Retries undelivered notifications.
 * Ambiguous or inconsistent cases become payment_issues for an administrator;
 * every applied change goes through the same atomic ledger functions as webhooks.
 */

import { logger } from "../logger/logger";
import { IPaymentOrderRepository } from "../repositories/payment-order-repository.interface";
import { SupabasePaymentOrderRepository } from "../repositories/supabase-payment-order-repository";
import { IPaymentTransactionRepository } from "../repositories/payment-transaction-repository.interface";
import { SupabasePaymentTransactionRepository } from "../repositories/supabase-payment-transaction-repository";
import { IWebhookEventRepository } from "../repositories/webhook-event-repository.interface";
import { SupabaseWebhookEventRepository } from "../repositories/supabase-webhook-event-repository";
import { IPaymentLedgerRepository, SupabasePaymentLedgerRepository } from "../repositories/payment-ledger-repository";
import { PaymentConfirmationService, paymentConfirmationService } from "./payment-confirmation-service";
import { PaymentNotificationService, paymentNotificationService } from "./payment-notification-service";
import { PaymentRefundService, paymentRefundService } from "./payment-refund-service";
import { RazorpayWebhookProcessor, razorpayWebhookProcessor } from "./razorpay-webhook-processor";

export interface ReconciliationReport {
  startedAt: string;
  finishedAt: string;
  webhooks: { retried: number; processed: number; failed: number };
  orders: { checked: number; changed: number; errors: number };
  authorizedNotCaptured: number;
  refunds: { resubmitted: number; updated: number; errors: number };
  notifications: { sent: number; failed: number; skipped: number };
}

const ORDER_MIN_AGE_MS = 5 * 60 * 1000; // give webhooks a head start
const ORDER_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const AUTHORIZED_ALERT_AGE_MS = 6 * 3600 * 1000; // Razorpay auto-refunds uncaptured payments after ~3 days

export class PaymentReconciliationService {
  private orders: IPaymentOrderRepository;
  private transactions: IPaymentTransactionRepository;
  private webhooks: IWebhookEventRepository;
  private ledger: IPaymentLedgerRepository;
  private confirmation: Pick<PaymentConfirmationService, "syncOrderWithProvider">;
  private processor: Pick<RazorpayWebhookProcessor, "process">;
  private refunds: Pick<PaymentRefundService, "reconcileOpenRefunds">;
  private notifications: Pick<PaymentNotificationService, "retryPending" | "notifyPaymentOutcome">;

  constructor(deps?: {
    orders?: IPaymentOrderRepository;
    transactions?: IPaymentTransactionRepository;
    webhooks?: IWebhookEventRepository;
    ledger?: IPaymentLedgerRepository;
    confirmation?: Pick<PaymentConfirmationService, "syncOrderWithProvider">;
    processor?: Pick<RazorpayWebhookProcessor, "process">;
    refunds?: Pick<PaymentRefundService, "reconcileOpenRefunds">;
    notifications?: Pick<PaymentNotificationService, "retryPending" | "notifyPaymentOutcome">;
  }) {
    this.orders = deps?.orders || new SupabasePaymentOrderRepository();
    this.transactions = deps?.transactions || new SupabasePaymentTransactionRepository();
    this.webhooks = deps?.webhooks || new SupabaseWebhookEventRepository();
    this.ledger = deps?.ledger || new SupabasePaymentLedgerRepository();
    this.confirmation = deps?.confirmation || paymentConfirmationService;
    this.processor = deps?.processor || razorpayWebhookProcessor;
    this.refunds = deps?.refunds || paymentRefundService;
    this.notifications = deps?.notifications || paymentNotificationService;
  }

  async run(options?: { now?: Date; limit?: number; actor?: { type: "admin" | "system"; id: string | null }; requestId?: string }): Promise<ReconciliationReport> {
    const now = options?.now ?? new Date();
    const limit = options?.limit ?? 50;
    const report: ReconciliationReport = {
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      webhooks: { retried: 0, processed: 0, failed: 0 },
      orders: { checked: 0, changed: 0, errors: 0 },
      authorizedNotCaptured: 0,
      refunds: { resubmitted: 0, updated: 0, errors: 0 },
      notifications: { sent: 0, failed: 0, skipped: 0 },
    };

    // 1. Stuck / failed webhook events (lease expired).
    try {
      const stuck = await this.webhooks.listRetryableEvents("razorpay", new Date(now.getTime() - 60_000).toISOString(), limit);
      for (const candidate of stuck) {
        const claimed = await this.webhooks.claimWebhookEvent(candidate.id, 60, 10);
        if (!claimed) continue;
        report.webhooks.retried++;
        const result = await this.processor.process(claimed);
        await this.webhooks.updateWebhookEventStatus(claimed.id, result.status, {
          processingError: result.error ?? null,
          processedAt: result.status === "failed" ? null : new Date().toISOString(),
        });
        if (result.status === "failed") report.webhooks.failed++;
        else report.webhooks.processed++;
        if (result.paymentOutcome) {
          const { outcome, orderId, consultationId } = result.paymentOutcome;
          await this.notifications.notifyPaymentOutcome(outcome, orderId, consultationId);
        }
      }
    } catch (err) {
      logger.error("Reconciliation: webhook recovery failed", err, { requestId: options?.requestId });
    }

    // 2 + 3. Unpaid Razorpay orders vs provider truth.
    try {
      const open = await this.orders.listOpenOrders(
        "razorpay",
        new Date(now.getTime() - ORDER_MIN_AGE_MS).toISOString(),
        new Date(now.getTime() - ORDER_MAX_AGE_MS).toISOString(),
        limit
      );
      for (const order of open) {
        report.orders.checked++;
        try {
          const result = await this.confirmation.syncOrderWithProvider(order);
          if (result?.success) {
            if (result.outcome !== "payment_failed" && result.outcome !== "payment_pending") report.orders.changed++;
            await this.notifications.notifyPaymentOutcome(result.outcome, result.orderId, result.consultationId);
          }
          if (!order.gatewayOrderId && !result) {
            // Creation outcome unknown and Razorpay has no order with this receipt:
            // nothing can have been paid, but keep it visible until the hold lapses.
            await this.ledger.recordIssue({
              provider: "razorpay",
              kind: "order_creation_unknown",
              paymentOrderId: order.id,
              consultationId: order.consultationId,
              gatewayReference: order.receipt,
              detail: "Local order has no Razorpay order; none found by receipt.",
            });
          }
          const txns = await this.transactions.getTransactionsByOrderId(order.id);
          const staleAuthorized = txns.filter(
            (t) => t.status === "pending" && now.getTime() - new Date(t.createdAt).getTime() > AUTHORIZED_ALERT_AGE_MS
          );
          for (const t of staleAuthorized) {
            report.authorizedNotCaptured++;
            await this.ledger.recordIssue({
              provider: "razorpay",
              kind: "authorized_not_captured",
              paymentOrderId: order.id,
              consultationId: order.consultationId,
              gatewayReference: t.gatewayPaymentId,
              detail: "Payment authorized but not captured; check Razorpay capture settings.",
            });
          }
        } catch (err) {
          report.orders.errors++;
          logger.error("Reconciliation: order check failed", err, { orderId: order.id });
          await this.ledger
            .recordIssue({
              provider: "razorpay",
              kind: "reconciliation_error",
              paymentOrderId: order.id,
              consultationId: order.consultationId,
              detail: err instanceof Error ? err.message.slice(0, 300) : "unknown error",
            })
            .catch(() => undefined);
        }
      }
    } catch (err) {
      logger.error("Reconciliation: order listing failed", err, { requestId: options?.requestId });
    }

    // 4. Refunds.
    try {
      report.refunds = await this.refunds.reconcileOpenRefunds(limit);
    } catch (err) {
      logger.error("Reconciliation: refund pass failed", err, { requestId: options?.requestId });
    }

    // 5. Notifications.
    try {
      report.notifications = await this.notifications.retryPending(limit);
    } catch (err) {
      logger.error("Reconciliation: notification pass failed", err, { requestId: options?.requestId });
    }

    report.finishedAt = new Date().toISOString();
    await this.ledger
      .appendAudit({
        actorType: options?.actor?.type ?? "system",
        actorId: options?.actor?.id ?? null,
        action: "reconciliation_run",
        entityType: "reconciliation",
        requestId: options?.requestId ?? null,
        metadata: report as unknown as Record<string, unknown>,
      })
      .catch((err) => logger.error("Reconciliation: audit append failed", err));

    logger.info("Payment reconciliation finished", { requestId: options?.requestId, ...report.orders });
    return report;
  }
}

export const paymentReconciliationService = new PaymentReconciliationService();
