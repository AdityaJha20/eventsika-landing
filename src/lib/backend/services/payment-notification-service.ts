/**
 * Payment notification dispatcher.
 *
 * - Every notification is claimed through claim_payment_notification (dedupe key +
 *   lease), so duplicate webhooks / callbacks / reconciliation runs cannot send twice.
 * - Delivery failure only marks the ledger row failed for retry; it never changes
 *   payment or consultation state.
 * - Receipts go out only after a paid outcome; confirmations (with calendar invite)
 *   only for a confirmed consultation; the slot-conflict email says explicitly that
 *   the appointment is NOT confirmed.
 */

import { logger } from "../logger/logger";
import { getServerConfig } from "../config/env";
import { sendTransactionalEmail, TransactionalEmail, TransactionalEmailResult } from "../../mailer";
import { IPaymentLedgerRepository, SupabasePaymentLedgerRepository } from "../repositories/payment-ledger-repository";
import { IConsultationRepository } from "../repositories/consultation-repository.interface";
import { SupabaseConsultationRepository } from "../repositories/supabase-consultation-repository";
import { IConsultationSlotRepository } from "../repositories/consultation-slot-repository.interface";
import { SupabaseConsultationSlotRepository } from "../repositories/supabase-consultation-slot-repository";
import { IPaymentOrderRepository } from "../repositories/payment-order-repository.interface";
import { SupabasePaymentOrderRepository } from "../repositories/supabase-payment-order-repository";
import { IPaymentTransactionRepository } from "../repositories/payment-transaction-repository.interface";
import { SupabasePaymentTransactionRepository } from "../repositories/supabase-payment-transaction-repository";
import { IPaymentRefundRepository } from "../repositories/payment-refund-repository.interface";
import { SupabasePaymentRefundRepository } from "../repositories/supabase-payment-refund-repository";
import { PaymentNotificationKind } from "../types/payment-and-consultation";
import {
  BookingDetails,
  bookingConfirmedEmail,
  EmailContent,
  paymentReceiptEmail,
  refundEmail,
  slotConflictEmail,
} from "../notifications/payment-email-templates";
import { PaymentConfirmationOutcome } from "./payment-confirmation-service";

export const MAX_NOTIFICATION_ATTEMPTS = 8;

export interface NotificationRequest {
  kind: PaymentNotificationKind;
  dedupeKey: string;
  consultationId: string;
  paymentOrderId?: string | null;
  refundId?: string | null;
}

export type EmailSender = (email: TransactionalEmail) => Promise<TransactionalEmailResult>;

export class PaymentNotificationService {
  private ledger: IPaymentLedgerRepository;
  private consultations: IConsultationRepository;
  private slots: IConsultationSlotRepository;
  private orders: IPaymentOrderRepository;
  private transactions: IPaymentTransactionRepository;
  private refunds: IPaymentRefundRepository;
  private send: EmailSender;
  private siteUrl: () => string;

  constructor(deps?: {
    ledger?: IPaymentLedgerRepository;
    consultations?: IConsultationRepository;
    slots?: IConsultationSlotRepository;
    orders?: IPaymentOrderRepository;
    transactions?: IPaymentTransactionRepository;
    refunds?: IPaymentRefundRepository;
    send?: EmailSender;
    siteUrl?: () => string;
  }) {
    this.ledger = deps?.ledger || new SupabasePaymentLedgerRepository();
    this.consultations = deps?.consultations || new SupabaseConsultationRepository();
    this.slots = deps?.slots || new SupabaseConsultationSlotRepository();
    this.orders = deps?.orders || new SupabasePaymentOrderRepository();
    this.transactions = deps?.transactions || new SupabasePaymentTransactionRepository();
    this.refunds = deps?.refunds || new SupabasePaymentRefundRepository();
    this.send = deps?.send || sendTransactionalEmail;
    this.siteUrl = deps?.siteUrl || (() => getServerConfig().siteUrl);
  }

  /** Notifications implied by a payment outcome (idempotent; safe to call repeatedly). */
  requestsForPaymentOutcome(
    outcome: PaymentConfirmationOutcome,
    orderId: string,
    consultationId: string
  ): NotificationRequest[] {
    const receipt: NotificationRequest = {
      kind: "payment_receipt",
      dedupeKey: `payment_receipt:${orderId}`,
      consultationId,
      paymentOrderId: orderId,
    };
    if (outcome === "confirmed" || outcome === "already_confirmed") {
      return [
        receipt,
        { kind: "booking_confirmed", dedupeKey: `booking_confirmed:${consultationId}`, consultationId, paymentOrderId: orderId },
      ];
    }
    if (outcome === "slot_conflict") {
      return [
        receipt,
        {
          kind: "slot_conflict_action_required",
          dedupeKey: `slot_conflict:${orderId}`,
          consultationId,
          paymentOrderId: orderId,
        },
      ];
    }
    return [];
  }

  async notifyPaymentOutcome(outcome: PaymentConfirmationOutcome, orderId: string, consultationId: string): Promise<void> {
    for (const req of this.requestsForPaymentOutcome(outcome, orderId, consultationId)) {
      await this.dispatch(req);
    }
  }

  /** Claims, renders and sends one notification. Never throws. */
  async dispatch(req: NotificationRequest): Promise<"sent" | "skipped" | "failed"> {
    let claim;
    try {
      claim = await this.ledger.claimNotification(req);
    } catch (err) {
      logger.error("Failed to claim payment notification", err, { kind: req.kind });
      return "failed";
    }
    if (!claim) return "skipped"; // already sent, leased elsewhere, or exhausted

    try {
      const content = await this.render(req);
      if (!content) {
        await this.ledger.completeNotification(claim.id, { sent: false, error: "not applicable for current state" });
        return "skipped";
      }
      const email = await this.recipient(req.consultationId);
      const result = await this.send({ to: email, ...content });
      await this.ledger.completeNotification(claim.id, {
        sent: result.delivered,
        error: result.error ?? null,
        providerMessageId: result.providerMessageId ?? null,
      });
      if (!result.delivered) {
        await this.flagIfExhausted(req, claim.attempts, result.error ?? "delivery failed");
        return "failed";
      }
      logger.info("Payment notification sent", { kind: req.kind, channel: result.channel });
      return "sent";
    } catch (err) {
      logger.error("Payment notification failed", err, { kind: req.kind });
      await this.ledger
        .completeNotification(claim.id, { sent: false, error: err instanceof Error ? err.message : "render/send error" })
        .catch(() => undefined);
      await this.flagIfExhausted(req, claim.attempts, "render/send error");
      return "failed";
    }
  }

  async retryPending(limit = 25): Promise<{ sent: number; failed: number; skipped: number }> {
    const counts = { sent: 0, failed: 0, skipped: 0 };
    const pending = await this.ledger.listRetryableNotifications(limit);
    for (const n of pending) {
      counts[await this.dispatch(n)]++;
    }
    return counts;
  }

  private async flagIfExhausted(req: NotificationRequest, attempts: number, error: string): Promise<void> {
    if (attempts < MAX_NOTIFICATION_ATTEMPTS) return;
    await this.ledger
      .recordIssue({
        provider: "razorpay",
        kind: "notification_failed",
        paymentOrderId: req.paymentOrderId ?? null,
        consultationId: req.consultationId,
        gatewayReference: req.dedupeKey.slice(0, 100),
        detail: `${req.kind}: ${error}`.slice(0, 500),
      })
      .catch(() => undefined);
  }

  private async recipient(consultationId: string): Promise<string> {
    const c = await this.consultations.getConsultationById(consultationId);
    if (!c) throw new Error("consultation not found");
    return c.customerEmail;
  }

  private async bookingDetails(consultationId: string, orderId: string | null | undefined): Promise<BookingDetails> {
    const consultation = await this.consultations.getConsultationById(consultationId);
    if (!consultation) throw new Error("consultation not found");
    const order = orderId ? await this.orders.getOrderById(orderId) : null;
    if (!order) throw new Error("payment order not found");
    const txns = await this.transactions.getTransactionsByOrderId(order.id);
    const captured = txns.find((t) => t.status === "success") ?? null;
    const slot = consultation.slotId ? await this.slots.getSlotById(consultation.slotId) : null;
    return {
      consultationId,
      customerFirstName: consultation.customerFirstName,
      meetingChannel: consultation.meetingChannel,
      slotStartIso: slot?.startTime ?? null,
      slotEndIso: slot?.endTime ?? null,
      amountInPaise: order.amountInPaise,
      paymentReference: order.receipt ?? order.gatewayOrderId ?? order.id,
      gatewayPaymentId: captured?.gatewayPaymentId ?? null,
      sequence: consultation.rescheduleCount,
    };
  }

  /** Renders content against CURRENT state; returns null when it no longer applies. */
  private async render(req: NotificationRequest): Promise<EmailContent | null> {
    if (req.kind === "refund_processing" || req.kind === "refund_processed") {
      const refund = req.refundId ? await this.refunds.getRefundById(req.refundId) : null;
      if (!refund) throw new Error("refund not found");
      if (req.kind === "refund_processed" && refund.status !== "succeeded") return null;
      const consultation = await this.consultations.getConsultationById(refund.consultationId);
      if (!consultation) throw new Error("consultation not found");
      const order = await this.orders.getOrderById(refund.paymentOrderId);
      return refundEmail(
        consultation.customerFirstName,
        refund.amountInPaise,
        order?.receipt ?? refund.id,
        req.kind === "refund_processing" ? "processing" : "processed"
      );
    }

    const details = await this.bookingDetails(req.consultationId, req.paymentOrderId);
    const consultation = await this.consultations.getConsultationById(req.consultationId);
    const order = req.paymentOrderId ? await this.orders.getOrderById(req.paymentOrderId) : null;
    if (!order || order.status !== "paid") return null; // receipts only after authoritative payment

    switch (req.kind) {
      case "payment_receipt":
        return paymentReceiptEmail(details);
      case "booking_confirmed":
        return consultation?.status === "confirmed" ? bookingConfirmedEmail(details, "confirmed") : null;
      case "rescheduled":
        return consultation?.status === "confirmed" ? bookingConfirmedEmail(details, "rescheduled") : null;
      case "slot_conflict_action_required": {
        if (consultation?.status !== "slot_conflict_pending_reschedule" || !order.reservationToken) return null;
        // Fragment (#) keeps the booking token out of server and proxy logs.
        const url = `${this.siteUrl()}/consultation/status#c=${req.consultationId}&t=${order.reservationToken}`;
        return slotConflictEmail(details, url);
      }
      default:
        return null;
    }
  }
}

export const paymentNotificationService = new PaymentNotificationService();
