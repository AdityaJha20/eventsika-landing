/**
 * Consultation Payment Domain Service
 *
 * Existing reservation ('slot_held')
 *   -> server-authoritative validation (slot, token, >=120s hold left, server price)
 *   -> local payment_orders row persisted FIRST (provider 'razorpay', stable receipt)
 *   -> Razorpay order created or recovered by receipt (never created twice)
 *   -> consultation 'slot_held' -> 'awaiting_payment'
 *   -> Checkout parameters (public Key ID, provider order ID, server amount)
 *
 * The browser never supplies amount, currency, status or order identity.
 */

import crypto from "node:crypto";
import { logger } from "../logger/logger";
import { IConsultationSlotRepository } from "../repositories/consultation-slot-repository.interface";
import { SupabaseConsultationSlotRepository } from "../repositories/supabase-consultation-slot-repository";
import { IConsultationRepository } from "../repositories/consultation-repository.interface";
import { SupabaseConsultationRepository } from "../repositories/supabase-consultation-repository";
import { IPaymentOrderRepository } from "../repositories/payment-order-repository.interface";
import { SupabasePaymentOrderRepository } from "../repositories/supabase-payment-order-repository";
import { IPaymentTransactionRepository } from "../repositories/payment-transaction-repository.interface";
import { SupabasePaymentTransactionRepository } from "../repositories/supabase-payment-transaction-repository";
import {
  IPaymentLedgerRepository,
  SupabasePaymentLedgerRepository,
} from "../repositories/payment-ledger-repository";
import { GatewayError, IOrderPaymentGateway } from "../integrations/payment-gateway.interface";
import { RazorpayPaymentGateway } from "../integrations/razorpay-payment-gateway";
import { getServerConfig } from "../config/env";
import {
  DEFAULT_CONSULTATION_PRICE_PAISE,
  PaymentOrderRecord,
} from "../types/payment-and-consultation";
import { ValidatedPaymentOrderInput } from "../validation/payment-order-schema";

export const MIN_RESERVATION_SAFETY_LIFETIME_SECONDS = 120;

export type PaymentServiceErrorCode =
  | "VALIDATION_ERROR"
  | "CONSULTATION_NOT_FOUND"
  | "SLOT_NOT_FOUND"
  | "INVALID_CONSULTATION_STATUS"
  | "CONSULTATION_CANCELLED"
  | "CONSULTATION_ALREADY_CONFIRMED"
  | "CONSULTATION_HAS_NO_SLOT"
  | "SLOT_NOT_RESERVED"
  | "INVALID_RESERVATION_TOKEN"
  | "RESERVATION_EXPIRED"
  | "RESERVATION_EXPIRING_SOON"
  | "PAYMENT_ALREADY_COMPLETED"
  | "PAYMENT_VERIFICATION_PENDING"
  | "PAYMENTS_UNAVAILABLE"
  | "GATEWAY_TIMEOUT"
  | "GATEWAY_ERROR"
  | "DATABASE_ERROR";

export interface CreatePaymentOrderSuccess {
  success: true;
  data: {
    keyId: string;
    gatewayOrderId: string;
    amountInPaise: number;
    currency: "INR";
    /** Seconds left on the server-held slot reservation when this response was built. */
    reservationExpiresInSeconds: number;
    reference: string;
    prefill: { name: string; email: string; contact: string };
  };
}

export interface CreatePaymentOrderFailure {
  success: false;
  error: PaymentServiceErrorCode;
  message: string;
}

export type CreatePaymentOrderResult =
  | CreatePaymentOrderSuccess
  | CreatePaymentOrderFailure;

/**
 * Stable Razorpay receipt for a consultation (<= 40 chars, ASCII).
 * 'rcpt_' + 32 hex chars = 37 characters.
 */
export function buildRazorpayReceipt(consultationId: string): string {
  return `rcpt_${consultationId.replace(/-/g, "")}`;
}

/**
 * Legacy: deterministic Cashfree merchant order ID (historical records only).
 * Example: 'c7c88b90-d461-4fa3-a75d-f152d113ba4c' -> 'ord_c7c88b90d4614fa3a75df152d113ba4c' (36 chars)
 */
export function buildDeterministicGatewayOrderId(consultationId: string): string {
  return `ord_${consultationId.replace(/-/g, "")}`;
}

/**
 * Timing-safe string comparison preventing timing leakage during reservation token verification.
 */
function timingSafeTokenCompare(a: string | null, b: string): boolean {
  if (!a || !b) {
    return false;
  }
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export class ConsultationPaymentService {
  private slotRepo: IConsultationSlotRepository;
  private consultationRepo: IConsultationRepository;
  private paymentOrderRepo: IPaymentOrderRepository;
  private transactionRepo: IPaymentTransactionRepository;
  private ledger: IPaymentLedgerRepository;
  private gateway: IOrderPaymentGateway;
  private keyIdResolver: () => string;

  constructor(deps?: {
    slotRepo?: IConsultationSlotRepository;
    consultationRepo?: IConsultationRepository;
    paymentOrderRepo?: IPaymentOrderRepository;
    transactionRepo?: IPaymentTransactionRepository;
    ledger?: IPaymentLedgerRepository;
    gateway?: IOrderPaymentGateway;
    keyIdResolver?: () => string;
  }) {
    this.slotRepo = deps?.slotRepo || new SupabaseConsultationSlotRepository();
    this.consultationRepo = deps?.consultationRepo || new SupabaseConsultationRepository();
    this.paymentOrderRepo = deps?.paymentOrderRepo || new SupabasePaymentOrderRepository();
    this.transactionRepo = deps?.transactionRepo || new SupabasePaymentTransactionRepository();
    this.ledger = deps?.ledger || new SupabasePaymentLedgerRepository();
    this.gateway = deps?.gateway || new RazorpayPaymentGateway();
    this.keyIdResolver = deps?.keyIdResolver || (() => getServerConfig().razorpay.keyId || "");
  }

  /**
   * Order creation pipeline (see file header). Steps 1-7 are unchanged from the
   * Cashfree implementation; steps 8-13 are provider-specific to Razorpay.
   */
  async createPaymentOrder(
    input: ValidatedPaymentOrderInput,
    context?: { requestId?: string; clientIp?: string; serverNow?: Date }
  ): Promise<CreatePaymentOrderResult> {
    const requestId = context?.requestId;
    const serverNow = context?.serverNow || new Date();

    // --------------------------------------------------------------------------
    // Step 1: Load Consultation Record
    // --------------------------------------------------------------------------
    let consultation;
    try {
      consultation = await this.consultationRepo.getConsultationById(input.consultationId);
    } catch (err) {
      logger.error("Failed to load consultation for payment order creation", err, {
        requestId,
        consultationId: input.consultationId,
      });
      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Unable to verify consultation details. Please try again.",
      };
    }

    if (!consultation) {
      return {
        success: false,
        error: "CONSULTATION_NOT_FOUND",
        message: "The requested consultation could not be found.",
      };
    }

    // --------------------------------------------------------------------------
    // Step 2: Validate Consultation Status
    // --------------------------------------------------------------------------
    if (consultation.status === "confirmed") {
      return {
        success: false,
        error: "CONSULTATION_ALREADY_CONFIRMED",
        message: "This consultation has already been confirmed.",
      };
    }

    if (
      consultation.status === "cancelled_customer" ||
      consultation.status === "cancelled_eventsika" ||
      consultation.status === "no_show"
    ) {
      return {
        success: false,
        error: "CONSULTATION_CANCELLED",
        message: "This consultation has been cancelled.",
      };
    }

    if (consultation.status !== "slot_held" && consultation.status !== "awaiting_payment") {
      return {
        success: false,
        error: "INVALID_CONSULTATION_STATUS",
        message: `Consultation cannot accept payment in '${consultation.status}' state.`,
      };
    }

    // --------------------------------------------------------------------------
    // Step 3: Verify Consultation Slot Linkage
    // --------------------------------------------------------------------------
    if (!consultation.slotId) {
      return {
        success: false,
        error: "CONSULTATION_HAS_NO_SLOT",
        message: "This consultation does not have a reserved slot.",
      };
    }

    // --------------------------------------------------------------------------
    // Step 4: Load Slot Record
    // --------------------------------------------------------------------------
    let slot;
    try {
      slot = await this.slotRepo.getSlotById(consultation.slotId);
    } catch (err) {
      logger.error("Failed to load slot for payment order creation", err, {
        requestId,
        slotId: consultation.slotId,
      });
      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Unable to verify slot reservation status. Please try again.",
      };
    }

    if (!slot) {
      return {
        success: false,
        error: "SLOT_NOT_FOUND",
        message: "The reserved slot associated with this consultation could not be found.",
      };
    }

    // --------------------------------------------------------------------------
    // Step 5: Verify Slot Status
    // --------------------------------------------------------------------------
    if (slot.status !== "reserved") {
      return {
        success: false,
        error: "SLOT_NOT_RESERVED",
        message: "The slot associated with this consultation is no longer held in reservation.",
      };
    }

    // --------------------------------------------------------------------------
    // Step 6: Timing-Safe Reservation Token Verification
    // --------------------------------------------------------------------------
    if (!timingSafeTokenCompare(slot.reservationToken, input.reservationToken)) {
      logger.warn("Reservation token mismatch rejected during payment order creation", {
        requestId,
        consultationId: consultation.id,
      });
      return {
        success: false,
        error: "INVALID_RESERVATION_TOKEN",
        message: "Invalid reservation token provided for this consultation hold.",
      };
    }

    // --------------------------------------------------------------------------
    // Step 7: Authoritative 120-Second Reservation Safety Rule
    // --------------------------------------------------------------------------
    if (!slot.reservedUntil) {
      return {
        success: false,
        error: "RESERVATION_EXPIRED",
        message: "The reservation hold timestamp is missing or expired.",
      };
    }

    const reservedUntilTime = new Date(slot.reservedUntil).getTime();
    const remainingSeconds = Math.floor((reservedUntilTime - serverNow.getTime()) / 1000);

    if (remainingSeconds <= 0) {
      logger.info("Reservation expired rejected before contacting gateway", {
        requestId,
        consultationId: consultation.id,
        remainingSeconds,
      });
      return {
        success: false,
        error: "RESERVATION_EXPIRED",
        message: "Your consultation reservation hold has expired. Please select an available slot to reserve a fresh 15-minute booking window.",
      };
    }

    if (remainingSeconds < MIN_RESERVATION_SAFETY_LIFETIME_SECONDS) {
      logger.info("Reservation expiring soon rejected (<120s safety threshold)", {
        requestId,
        consultationId: consultation.id,
        remainingSeconds,
      });
      return {
        success: false,
        error: "RESERVATION_EXPIRING_SOON",
        message: "Your reservation hold is expiring in less than 2 minutes. To prevent payment issues, please select an available slot to reserve a fresh 15-minute booking window.",
      };
    }

    // --------------------------------------------------------------------------
    // Step 8: Inspect the consultation's live order (idempotency, recovery, retry)
    // A Razorpay order accepts several payment attempts, so a failed attempt is
    // retried on the SAME order: no new consultation, no new order.
    // --------------------------------------------------------------------------
    let order: PaymentOrderRecord | null = null;
    try {
      order = await this.paymentOrderRepo.getLatestOrderByConsultationId(consultation.id);
    } catch (err) {
      logger.error("Failed to inspect existing payment orders", err, {
        requestId,
        consultationId: consultation.id,
      });
      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Unable to verify payment order history. Please try again.",
      };
    }

    if (order?.status === "paid") {
      return {
        success: false,
        error: "PAYMENT_ALREADY_COMPLETED",
        message: "Payment for this consultation has already been completed.",
      };
    }

    const isLiveOrder = order && (order.status === "created" || order.status === "attempted");

    if (isLiveOrder && order!.provider !== "razorpay") {
      // Legacy Cashfree attempt still in flight: never open a second payment path.
      return {
        success: false,
        error: "PAYMENT_VERIFICATION_PENDING",
        message: "Your earlier payment is still being verified. Please do not pay again.",
      };
    }

    if (isLiveOrder) {
      try {
        const txns = await this.transactionRepo.getTransactionsByOrderId(order!.id);
        if (txns.some((t) => t.status === "pending" || t.status === "success")) {
          return {
            success: false,
            error: "PAYMENT_VERIFICATION_PENDING",
            message: "Your payment is being verified. Please do not pay again.",
          };
        }
      } catch (err) {
        logger.error("Failed to inspect payment attempts", err, { requestId, orderId: order!.id });
        return {
          success: false,
          error: "DATABASE_ERROR",
          message: "Unable to verify payment order history. Please try again.",
        };
      }
    } else {
      // ------------------------------------------------------------------------
      // Step 9: Persist the local order BEFORE contacting Razorpay. The receipt is
      // deterministic per consultation, so concurrent requests collide on a unique
      // index and an unknown creation outcome can be recovered by receipt.
      // ------------------------------------------------------------------------
      const receipt = buildRazorpayReceipt(consultation.id);
      try {
        order = await this.paymentOrderRepo.createOrder({
          consultationId: consultation.id,
          provider: "razorpay",
          receipt,
          amountInPaise: DEFAULT_CONSULTATION_PRICE_PAISE,
          currency: "INR",
          expiresAt: slot.reservedUntil,
          reservationToken: slot.reservationToken!,
          requestId: requestId || null,
        });
      } catch (dbErr) {
        const isUniqueConflict =
          (dbErr as { code?: string })?.code === "23505" || String(dbErr).includes("duplicate key");
        order = isUniqueConflict
          ? await this.paymentOrderRepo.getOrderByReceipt(receipt).catch(() => null)
          : null;
        if (!order || order.provider !== "razorpay" || (order.status !== "created" && order.status !== "attempted")) {
          logger.error("Failed to persist payment order locally", dbErr, {
            requestId,
            consultationId: consultation.id,
          });
          return {
            success: false,
            error: "DATABASE_ERROR",
            message: "Unable to record payment order. Please try again.",
          };
        }
      }
    }

    // --------------------------------------------------------------------------
    // Step 10: Ensure the order exists at Razorpay exactly once.
    // --------------------------------------------------------------------------
    if (!order!.gatewayOrderId) {
      try {
        const remote =
          (await this.gateway.findOrderByReceipt(order!.receipt!)) ??
          (await this.gateway.createOrder({
            receipt: order!.receipt!,
            amountInPaise: order!.amountInPaise,
            currency: "INR",
            notes: { payment_order_id: order!.id, consultation_id: consultation.id },
          }));
        if (remote.amountInPaise !== order!.amountInPaise || remote.currency !== order!.currency) {
          logger.error("Razorpay order amount/currency differs from local order", undefined, {
            requestId,
            orderId: order!.id,
          });
          await this.ledger
            .recordIssue({
              provider: "razorpay",
              kind: "amount_mismatch",
              paymentOrderId: order!.id,
              consultationId: consultation.id,
              gatewayReference: remote.id,
              detail: "Razorpay order amount/currency differs from the local order",
            })
            .catch(() => undefined);
          return {
            success: false,
            error: "GATEWAY_ERROR",
            message: "Payment provider returned an inconsistent order. Please contact support.",
          };
        }
        order = await this.paymentOrderRepo.attachGatewayOrderId(order!.id, remote.id);
      } catch (gwErr) {
        const timedOut =
          gwErr instanceof GatewayError &&
          (gwErr.code === "GATEWAY_TIMEOUT" || gwErr.code === "NETWORK_ERROR");
        logger.error("Razorpay order creation did not complete", gwErr, {
          requestId,
          orderId: order!.id,
          code: gwErr instanceof GatewayError ? gwErr.code : "UNKNOWN",
        });
        // The local row keeps its receipt; the next attempt (or reconciliation)
        // recovers the remote order by receipt instead of creating a duplicate.
        return {
          success: false,
          error: timedOut ? "GATEWAY_TIMEOUT" : "GATEWAY_ERROR",
          message: "Payment provider did not respond. Please try again in a moment.",
        };
      }
    }

    // --------------------------------------------------------------------------
    // Step 11: Post-gateway expiry verification
    // --------------------------------------------------------------------------
    const postCheckNow = context?.serverNow || new Date();
    if (new Date(slot.reservedUntil).getTime() - postCheckNow.getTime() <= 0) {
      return {
        success: false,
        error: "RESERVATION_EXPIRED",
        message:
          "Your reservation hold expired during payment order preparation. Please select an available slot to reserve a fresh booking window.",
      };
    }

    // --------------------------------------------------------------------------
    // Step 12: Consultation 'slot_held' -> 'awaiting_payment'
    // --------------------------------------------------------------------------
    if (consultation.status === "slot_held") {
      try {
        await this.consultationRepo.updateConsultationStatus(consultation.id, "awaiting_payment");
      } catch (statusErr) {
        logger.error("Failed to transition consultation to awaiting_payment", statusErr, {
          requestId,
          consultationId: consultation.id,
          orderId: order!.id,
        });
        return {
          success: false,
          error: "DATABASE_ERROR",
          message: "Unable to update consultation status. Please try again.",
        };
      }
    }

    // --------------------------------------------------------------------------
    // Step 13: Checkout parameters. Only the public Key ID leaves the server.
    // --------------------------------------------------------------------------
    return {
      success: true,
      data: {
        keyId: this.keyIdResolver(),
        gatewayOrderId: order!.gatewayOrderId!,
        amountInPaise: order!.amountInPaise,
        currency: "INR",
        reservationExpiresInSeconds: Math.max(
          0,
          Math.floor((new Date(slot.reservedUntil).getTime() - postCheckNow.getTime()) / 1000)
        ),
        reference: order!.receipt!,
        prefill: {
          name: `${consultation.customerFirstName} ${consultation.customerLastName}`.trim(),
          email: consultation.customerEmail,
          contact: consultation.customerPhone,
        },
      },
    };
  }
}

export const consultationPaymentService = new ConsultationPaymentService();
