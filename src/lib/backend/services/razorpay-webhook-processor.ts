/**
 * Processes a durably stored, signature-verified Razorpay webhook event.
 * Shared by the webhook route (first delivery / provider retries) and
 * reconciliation (events stuck after a crash or lease expiry).
 */

import { logger } from "../logger/logger";
import { parseStoredRazorpayEvent } from "../domain/razorpay-webhook";
import { WebhookEventRecord, WebhookEventStatus } from "../types/payment-and-consultation";
import {
  isTransientConfirmationError,
  PaymentConfirmationOutcome,
  PaymentConfirmationService,
  paymentConfirmationService,
} from "./payment-confirmation-service";
import { PaymentRefundService, paymentRefundService } from "./payment-refund-service";
import { IPaymentLedgerRepository, SupabasePaymentLedgerRepository } from "../repositories/payment-ledger-repository";

export interface ProcessedWebhook {
  status: Extract<WebhookEventStatus, "processed" | "rejected" | "ignored" | "failed">;
  error?: string;
  paymentOutcome?: { outcome: PaymentConfirmationOutcome; orderId: string; consultationId: string };
}

export class RazorpayWebhookProcessor {
  private confirmation: Pick<PaymentConfirmationService, "applyProviderPayment">;
  private refunds: Pick<PaymentRefundService, "applyProviderRefund">;
  private ledger: Pick<IPaymentLedgerRepository, "recordIssue">;

  constructor(deps?: {
    confirmation?: Pick<PaymentConfirmationService, "applyProviderPayment">;
    refunds?: Pick<PaymentRefundService, "applyProviderRefund">;
    ledger?: Pick<IPaymentLedgerRepository, "recordIssue">;
  }) {
    this.confirmation = deps?.confirmation || paymentConfirmationService;
    this.refunds = deps?.refunds || paymentRefundService;
    this.ledger = deps?.ledger || new SupabasePaymentLedgerRepository();
  }

  async process(event: WebhookEventRecord): Promise<ProcessedWebhook> {
    const parsed = parseStoredRazorpayEvent(event.payload);
    if (!parsed.success) return { status: "rejected", error: parsed.error };
    const data = parsed.data;

    try {
      if (data.kind === "payment") {
        const createdAt = typeof data.minimalPayload.created_at === "number"
          ? new Date((data.minimalPayload.created_at as number) * 1000).toISOString()
          : null;
        const result = await this.confirmation.applyProviderPayment(data.payment, createdAt);
        if (!result) return { status: "ignored" };
        if (result.success) {
          return {
            status: "processed",
            paymentOutcome: { outcome: result.outcome, orderId: result.orderId, consultationId: result.consultationId },
          };
        }
        return isTransientConfirmationError(result.error)
          ? { status: "failed", error: result.error }
          : { status: "rejected", error: result.error };
      }

      if (data.kind === "refund") {
        const updated = await this.refunds.applyProviderRefund(data.refund);
        if (!updated) {
          // A refund Eventsika never requested (dashboard refund, auto-refund of an
          // uncaptured payment). Keep it visible instead of silently ignoring it.
          await this.ledger.recordIssue({
            provider: "razorpay",
            kind: "untracked_refund",
            gatewayReference: data.refund.id,
            detail: `${data.eventType} for payment ${data.refund.paymentId}, ${data.refund.amountInPaise} paise`,
          });
          return { status: "processed" };
        }
        return { status: "processed" };
      }

      return { status: "ignored" };
    } catch (err) {
      logger.error("Razorpay webhook processing threw", err, { eventId: event.eventId });
      return { status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "processing error" };
    }
  }
}

export const razorpayWebhookProcessor = new RazorpayWebhookProcessor();
