/**
 * Customer-facing payment / booking status and slot-conflict recovery.
 *
 * Access requires the consultation ID plus the 256-bit reservation token the
 * customer received when holding the slot (compared in constant time against the
 * token stored on the payment order). Unknown IDs and wrong tokens get the same
 * NOT_FOUND answer, so one customer cannot probe another's booking.
 *
 * Only customer-safe fields are returned: no provider payloads, no internal issue
 * details, no secrets.
 */

import crypto from "node:crypto";
import { logger } from "../logger/logger";
import { IPaymentOrderRepository } from "../repositories/payment-order-repository.interface";
import { SupabasePaymentOrderRepository } from "../repositories/supabase-payment-order-repository";
import { IPaymentTransactionRepository } from "../repositories/payment-transaction-repository.interface";
import { SupabasePaymentTransactionRepository } from "../repositories/supabase-payment-transaction-repository";
import { IPaymentRefundRepository } from "../repositories/payment-refund-repository.interface";
import { SupabasePaymentRefundRepository } from "../repositories/supabase-payment-refund-repository";
import { IConsultationRepository } from "../repositories/consultation-repository.interface";
import { SupabaseConsultationRepository } from "../repositories/supabase-consultation-repository";
import { IConsultationSlotRepository } from "../repositories/consultation-slot-repository.interface";
import { SupabaseConsultationSlotRepository } from "../repositories/supabase-consultation-slot-repository";
import { IPaymentLedgerRepository, SupabasePaymentLedgerRepository } from "../repositories/payment-ledger-repository";
import { PaymentConfirmationService, paymentConfirmationService } from "./payment-confirmation-service";
import { PaymentNotificationService, paymentNotificationService } from "./payment-notification-service";
import {
  ConsultationStatus,
  PaymentOrderRecord,
  PaymentRefundRecord,
  PaymentTransactionRecord,
} from "../types/payment-and-consultation";

export type CustomerPaymentState =
  | "awaiting_payment"
  | "verifying"
  | "paid"
  | "failed"
  | "expired"
  | "refund_processing"
  | "partially_refunded"
  | "refunded";

export type CustomerBookingState =
  | "pending"
  | "confirmed"
  | "action_required"
  | "cancelled"
  | "completed"
  | "no_show"
  | "rescheduled";

export interface CustomerPaymentStatus {
  payment: CustomerPaymentState;
  booking: CustomerBookingState;
  slotStartTime: string | null;
  amountInPaise: number;
  reference: string | null;
  canRetryPayment: boolean;
}

export type StatusResult =
  | { success: true; data: CustomerPaymentStatus }
  | { success: false; error: "NOT_FOUND" | "DATABASE_ERROR" };

export type RebookResultCode =
  | "REBOOKED"
  | "NOT_FOUND"
  | "NOT_IN_CONFLICT"
  | "NOT_PAID"
  | "SLOT_UNAVAILABLE"
  | "DATABASE_ERROR";

function tokenMatches(stored: string | null, supplied: string): boolean {
  if (!stored || !supplied) return false;
  const a = Buffer.from(stored, "utf-8");
  const b = Buffer.from(supplied, "utf-8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function derivePaymentState(
  order: PaymentOrderRecord,
  txns: PaymentTransactionRecord[],
  refunds: PaymentRefundRecord[]
): CustomerPaymentState {
  if (order.status === "paid") {
    const refunded = refunds.filter((r) => r.status === "succeeded").reduce((s, r) => s + r.amountInPaise, 0);
    if (refunds.some((r) => r.status === "pending" || r.status === "initiated")) return "refund_processing";
    if (refunded >= order.amountInPaise) return "refunded";
    if (refunded > 0) return "partially_refunded";
    return "paid";
  }
  if (order.status === "expired") return "expired";
  if (txns.some((t) => t.status === "pending")) return "verifying";
  if (order.status === "failed") return "failed";
  const last = txns[txns.length - 1];
  if (last && (last.status === "failed" || last.status === "user_dropped")) return "failed";
  return "awaiting_payment";
}

export function deriveBookingState(status: ConsultationStatus): CustomerBookingState {
  switch (status) {
    case "confirmed":
      return "confirmed";
    case "slot_conflict_pending_reschedule":
      return "action_required";
    case "cancelled_customer":
    case "cancelled_eventsika":
      return "cancelled";
    case "completed":
      return "completed";
    case "no_show":
      return "no_show";
    case "rescheduled":
      return "rescheduled";
    default:
      return "pending";
  }
}

export class PaymentStatusService {
  private orders: IPaymentOrderRepository;
  private transactions: IPaymentTransactionRepository;
  private refunds: IPaymentRefundRepository;
  private consultations: IConsultationRepository;
  private slots: IConsultationSlotRepository;
  private ledger: IPaymentLedgerRepository;
  private confirmation: Pick<PaymentConfirmationService, "syncOrderWithProvider">;
  private notifications: Pick<PaymentNotificationService, "dispatch">;

  constructor(deps?: {
    orders?: IPaymentOrderRepository;
    transactions?: IPaymentTransactionRepository;
    refunds?: IPaymentRefundRepository;
    consultations?: IConsultationRepository;
    slots?: IConsultationSlotRepository;
    ledger?: IPaymentLedgerRepository;
    confirmation?: Pick<PaymentConfirmationService, "syncOrderWithProvider">;
    notifications?: Pick<PaymentNotificationService, "dispatch">;
  }) {
    this.orders = deps?.orders || new SupabasePaymentOrderRepository();
    this.transactions = deps?.transactions || new SupabasePaymentTransactionRepository();
    this.refunds = deps?.refunds || new SupabasePaymentRefundRepository();
    this.consultations = deps?.consultations || new SupabaseConsultationRepository();
    this.slots = deps?.slots || new SupabaseConsultationSlotRepository();
    this.ledger = deps?.ledger || new SupabasePaymentLedgerRepository();
    this.confirmation = deps?.confirmation || paymentConfirmationService;
    this.notifications = deps?.notifications || paymentNotificationService;
  }

  private async authorize(consultationId: string, token: string): Promise<PaymentOrderRecord | null> {
    const order = await this.orders.getLatestOrderByConsultationId(consultationId);
    return order && tokenMatches(order.reservationToken, token) ? order : null;
  }

  async getStatus(input: {
    consultationId: string;
    reservationToken: string;
    syncWithProvider: boolean;
    now?: Date;
  }): Promise<StatusResult> {
    try {
      let order = await this.authorize(input.consultationId, input.reservationToken);
      if (!order) return { success: false, error: "NOT_FOUND" };

      if (input.syncWithProvider && order.provider === "razorpay" && (order.status === "created" || order.status === "attempted")) {
        try {
          await this.confirmation.syncOrderWithProvider(order);
          order = (await this.orders.getOrderById(order.id)) ?? order;
        } catch (err) {
          // Provider lookup is best effort: the database stays authoritative.
          logger.warn("Provider sync during status check failed", {
            orderId: order.id,
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      }

      const [consultation, txns, refunds] = await Promise.all([
        this.consultations.getConsultationById(order.consultationId),
        this.transactions.getTransactionsByOrderId(order.id),
        this.refunds.getRefundsByOrderId(order.id),
      ]);
      if (!consultation) return { success: false, error: "NOT_FOUND" };

      const payment = derivePaymentState(order, txns, refunds);
      const booking = deriveBookingState(consultation.status);
      const slot = consultation.slotId ? await this.slots.getSlotById(consultation.slotId) : null;
      const now = (input.now ?? new Date()).getTime();
      const holdValid =
        !!slot &&
        slot.status === "reserved" &&
        slot.reservationToken === order.reservationToken &&
        !!slot.reservedUntil &&
        new Date(slot.reservedUntil).getTime() - now > 120_000;

      return {
        success: true,
        data: {
          payment,
          booking,
          slotStartTime: booking === "confirmed" ? slot?.startTime ?? null : null,
          amountInPaise: order.amountInPaise,
          reference: order.receipt ?? null,
          canRetryPayment: payment === "failed" && booking === "pending" && holdValid && order.provider === "razorpay",
        },
      };
    } catch (err) {
      logger.error("Customer payment status lookup failed", err, { consultationId: input.consultationId });
      return { success: false, error: "DATABASE_ERROR" };
    }
  }

  /**
   * Paid + slot-conflict: move the existing payment to a replacement slot.
   * No second payment; atomic in rebook_conflicted_consultation.
   */
  async rebookConflict(input: {
    consultationId: string;
    reservationToken: string;
    newSlotId: string;
  }): Promise<RebookResultCode> {
    let order: PaymentOrderRecord | null;
    try {
      order = await this.authorize(input.consultationId, input.reservationToken);
    } catch (err) {
      logger.error("Rebook authorization lookup failed", err, { consultationId: input.consultationId });
      return "DATABASE_ERROR";
    }
    if (!order) return "NOT_FOUND";

    let result;
    try {
      result = await this.ledger.rebookConflictedConsultation(input.consultationId, input.newSlotId);
    } catch (err) {
      logger.error("Rebook RPC failed", err, { consultationId: input.consultationId });
      return "DATABASE_ERROR";
    }

    switch (result) {
      case "rebooked":
        await this.notifications.dispatch({
          kind: "booking_confirmed",
          dedupeKey: `booking_confirmed:${input.consultationId}`,
          consultationId: input.consultationId,
          paymentOrderId: order.id,
        });
        return "REBOOKED";
      case "not_in_conflict":
        return "NOT_IN_CONFLICT";
      case "not_paid":
        return "NOT_PAID";
      case "slot_unavailable":
        return "SLOT_UNAVAILABLE";
      default:
        return "NOT_FOUND";
    }
  }
}

export const paymentStatusService = new PaymentStatusService();
