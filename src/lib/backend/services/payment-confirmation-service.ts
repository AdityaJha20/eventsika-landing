/**
 * Payment Confirmation Domain Service (Step 6B)
 *
 * Authoritatively handles asynchronous Cashfree payment webhook outcomes:
 *
 * 1. Loads internal payment_orders by external gateway order ID.
 * 2. Enforces strict amount and currency validation against authoritative order record.
 * 3. Idempotently appends immutable transaction ledger entries in payment_transactions.
 * 4. Advances payment_orders status ('created'/'attempted' -> 'paid', or 'failed'/'attempted').
 * 5. Cryptographically confirms consultation slot using ONLY payment_orders.reservation_token.
 * 6. Transitions consultations to 'confirmed' on success, or 'slot_conflict_pending_reschedule' on conflict.
 * 7. Recovers seamlessly from partial failures across the distributed PostgREST boundary.
 */

import { logger } from "../logger/logger";
import { IPaymentOrderRepository } from "../repositories/payment-order-repository.interface";
import { SupabasePaymentOrderRepository } from "../repositories/supabase-payment-order-repository";
import { IPaymentTransactionRepository } from "../repositories/payment-transaction-repository.interface";
import { SupabasePaymentTransactionRepository } from "../repositories/supabase-payment-transaction-repository";
import { IConsultationRepository } from "../repositories/consultation-repository.interface";
import { SupabaseConsultationRepository } from "../repositories/supabase-consultation-repository";
import { IConsultationSlotRepository } from "../repositories/consultation-slot-repository.interface";
import { SupabaseConsultationSlotRepository } from "../repositories/supabase-consultation-slot-repository";
import {
  PaymentOrderRecord,
  PaymentTransactionRecord,
  PaymentMethod,
} from "../types/payment-and-consultation";
import { NormalizedCashfreePaymentWebhook } from "../domain/webhook-types";

export type PaymentConfirmationOutcome =
  | "confirmed"
  | "slot_conflict"
  | "payment_failed"
  | "user_dropped"
  | "duplicate";

export type PaymentConfirmationErrorCode =
  | "ORDER_NOT_FOUND"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "CONSULTATION_NOT_FOUND"
  | "CONSULTATION_HAS_NO_SLOT"
  | "MISSING_RESERVATION_TOKEN"
  | "UNSUPPORTED_EVENT_TYPE"
  | "DATABASE_ERROR";

export interface PaymentConfirmationSuccess {
  success: true;
  outcome: PaymentConfirmationOutcome;
  orderId: string;
  consultationId: string;
  transactionId?: string;
  slotId?: string | null;
  message?: string;
}

export interface PaymentConfirmationFailure {
  success: false;
  error: PaymentConfirmationErrorCode;
  message: string;
  orderId?: string;
}

export type PaymentConfirmationResult =
  | PaymentConfirmationSuccess
  | PaymentConfirmationFailure;

/**
 * Normalizes payment method string into strongly typed PaymentMethod enum.
 */
function normalizePaymentMethod(method: string | null): PaymentMethod | null {
  if (!method) return null;
  const lower = method.toLowerCase();
  if (lower.includes("upi")) return "upi";
  if (lower.includes("card") || lower.includes("credit") || lower.includes("debit")) return "card";
  if (lower.includes("netbanking") || lower.includes("nb")) return "netbanking";
  if (lower.includes("wallet")) return "wallet";
  return null;
}

export class PaymentConfirmationService {
  private paymentOrderRepo: IPaymentOrderRepository;
  private paymentTransactionRepo: IPaymentTransactionRepository;
  private consultationRepo: IConsultationRepository;
  private slotRepo: IConsultationSlotRepository;

  constructor(
    paymentOrderRepo?: IPaymentOrderRepository,
    paymentTransactionRepo?: IPaymentTransactionRepository,
    consultationRepo?: IConsultationRepository,
    slotRepo?: IConsultationSlotRepository
  ) {
    this.paymentOrderRepo = paymentOrderRepo || new SupabasePaymentOrderRepository();
    this.paymentTransactionRepo =
      paymentTransactionRepo || new SupabasePaymentTransactionRepository();
    this.consultationRepo = consultationRepo || new SupabaseConsultationRepository();
    this.slotRepo = slotRepo || new SupabaseConsultationSlotRepository();
  }

  /**
   * Processes a normalized Cashfree payment webhook event.
   */
  async processPaymentWebhook(
    event: NormalizedCashfreePaymentWebhook
  ): Promise<PaymentConfirmationResult> {
    // --------------------------------------------------------------------------
    // 1. Load Authoritative Payment Order Record
    // --------------------------------------------------------------------------
    let paymentOrder: PaymentOrderRecord | null;
    try {
      paymentOrder = await this.paymentOrderRepo.getOrderByGatewayId(event.orderId);
    } catch (dbErr) {
      logger.error("Database error querying payment order by gateway ID", dbErr, {
        orderId: event.orderId,
      });
      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Failed to query payment order record.",
        orderId: event.orderId,
      };
    }

    if (!paymentOrder) {
      logger.warn("Received payment webhook for unknown payment order", {
        orderId: event.orderId,
        gatewayPaymentId: event.gatewayPaymentId,
      });
      return {
        success: false,
        error: "ORDER_NOT_FOUND",
        message: `Payment order "${event.orderId}" not found.`,
        orderId: event.orderId,
      };
    }

    // --------------------------------------------------------------------------
    // 2. Authoritative Amount & Currency Verification
    // --------------------------------------------------------------------------
    if (event.amountInPaise !== paymentOrder.amountInPaise) {
      logger.warn("Payment webhook amount mismatch detected", {
        orderId: paymentOrder.id,
        expectedPaise: paymentOrder.amountInPaise,
        receivedPaise: event.amountInPaise,
      });
      return {
        success: false,
        error: "AMOUNT_MISMATCH",
        message: `Payment amount (${event.amountInPaise} paise) does not match expected order amount (${paymentOrder.amountInPaise} paise).`,
        orderId: paymentOrder.id,
      };
    }

    if (event.currency !== paymentOrder.currency) {
      logger.warn("Payment webhook currency mismatch detected", {
        orderId: paymentOrder.id,
        expectedCurrency: paymentOrder.currency,
        receivedCurrency: event.currency,
      });
      return {
        success: false,
        error: "CURRENCY_MISMATCH",
        message: `Payment currency (${event.currency}) does not match expected order currency (${paymentOrder.currency}).`,
        orderId: paymentOrder.id,
      };
    }

    // --------------------------------------------------------------------------
    // 3. Handle PAYMENT_FAILED_WEBHOOK
    // --------------------------------------------------------------------------
    if (event.eventType === "PAYMENT_FAILED_WEBHOOK") {
      let transaction: PaymentTransactionRecord | null = null;
      if (event.gatewayPaymentId) {
        try {
          transaction = await this.paymentTransactionRepo.getTransactionByGatewayId(
            event.gatewayPaymentId
          );
        } catch (err) {
          logger.error("Database error checking existing transaction", err, {
            orderId: paymentOrder.id,
          });
        }
      }

      if (!transaction) {
        try {
          transaction = await this.paymentTransactionRepo.recordTransaction({
            paymentOrderId: paymentOrder.id,
            gatewayPaymentId: event.gatewayPaymentId,
            amountInPaise: event.amountInPaise,
            status: "failed",
            paymentMethod: normalizePaymentMethod(event.paymentMethod),
            bankReference: event.bankReference,
            errorCode: event.errorCode,
            errorDescription: event.errorDescription,
          });
        } catch (err) {
          const isConflict =
            (err as { code?: string })?.code === "23505" ||
            String(err).includes("23505") ||
            String(err).includes("duplicate key");
          if (isConflict && event.gatewayPaymentId) {
            transaction = await this.paymentTransactionRepo.getTransactionByGatewayId(
              event.gatewayPaymentId
            );
          }
          if (!transaction) {
            logger.error("Failed to record failed payment transaction", err, {
              orderId: paymentOrder.id,
            });
            return {
              success: false,
              error: "DATABASE_ERROR",
              message: "Failed to persist payment transaction.",
              orderId: paymentOrder.id,
            };
          }
        }
      }

      if (paymentOrder.status !== "paid" && paymentOrder.status !== "expired") {
        try {
          paymentOrder = await this.paymentOrderRepo.updateOrderStatus(
            paymentOrder.id,
            "failed"
          );
        } catch (err) {
          logger.error("Database error transitioning payment order to failed", err, {
            orderId: paymentOrder.id,
          });
          return {
            success: false,
            error: "DATABASE_ERROR",
            message: "Failed to update payment order status.",
            orderId: paymentOrder.id,
          };
        }
      } else if (paymentOrder.status === "paid") {
        logger.info("Ignoring failed webhook for already paid order", {
          orderId: paymentOrder.id,
        });
      }

      return {
        success: true,
        outcome: "payment_failed",
        orderId: paymentOrder.id,
        consultationId: paymentOrder.consultationId,
        transactionId: transaction?.id,
        message: "Payment failure recorded.",
      };
    }

    // --------------------------------------------------------------------------
    // 4. Handle PAYMENT_USER_DROPPED_WEBHOOK
    // --------------------------------------------------------------------------
    if (event.eventType === "PAYMENT_USER_DROPPED_WEBHOOK") {
      let transaction: PaymentTransactionRecord | null = null;
      if (event.gatewayPaymentId) {
        try {
          transaction = await this.paymentTransactionRepo.getTransactionByGatewayId(
            event.gatewayPaymentId
          );
        } catch (err) {
          logger.error("Database error checking existing transaction", err, {
            orderId: paymentOrder.id,
          });
        }
      }

      if (!transaction) {
        try {
          transaction = await this.paymentTransactionRepo.recordTransaction({
            paymentOrderId: paymentOrder.id,
            gatewayPaymentId: event.gatewayPaymentId,
            amountInPaise: event.amountInPaise,
            status: "user_dropped",
            paymentMethod: normalizePaymentMethod(event.paymentMethod),
            bankReference: event.bankReference,
            errorCode: event.errorCode,
            errorDescription: event.errorDescription,
          });
        } catch (err) {
          const isConflict =
            (err as { code?: string })?.code === "23505" ||
            String(err).includes("23505") ||
            String(err).includes("duplicate key");
          if (isConflict && event.gatewayPaymentId) {
            transaction = await this.paymentTransactionRepo.getTransactionByGatewayId(
              event.gatewayPaymentId
            );
          }
          if (!transaction) {
            logger.error("Failed to record user_dropped payment transaction", err, {
              orderId: paymentOrder.id,
            });
            return {
              success: false,
              error: "DATABASE_ERROR",
              message: "Failed to persist payment transaction.",
              orderId: paymentOrder.id,
            };
          }
        }
      }

      if (paymentOrder.status === "created") {
        try {
          paymentOrder = await this.paymentOrderRepo.updateOrderStatus(
            paymentOrder.id,
            "attempted"
          );
        } catch (err) {
          logger.error("Database error transitioning payment order to attempted", err, {
            orderId: paymentOrder.id,
          });
          return {
            success: false,
            error: "DATABASE_ERROR",
            message: "Failed to update payment order status.",
            orderId: paymentOrder.id,
          };
        }
      } else if (paymentOrder.status === "paid") {
        logger.info("Ignoring user_dropped webhook for already paid order", {
          orderId: paymentOrder.id,
        });
      }

      return {
        success: true,
        outcome: "user_dropped",
        orderId: paymentOrder.id,
        consultationId: paymentOrder.consultationId,
        transactionId: transaction?.id,
        message: "User dropped payment recorded.",
      };
    }

    // --------------------------------------------------------------------------
    // 5. Handle PAYMENT_SUCCESS_WEBHOOK
    // --------------------------------------------------------------------------
    if (event.eventType !== "PAYMENT_SUCCESS_WEBHOOK") {
      logger.warn("Unsupported payment event type received in confirmation service", {
        eventType: event.eventType,
        orderId: paymentOrder.id,
      });
      return {
        success: false,
        error: "UNSUPPORTED_EVENT_TYPE",
        message: `Unsupported event type: "${event.eventType}"`,
        orderId: paymentOrder.id,
      };
    }

    // Load consultation
    let consultation;
    try {
      consultation = await this.consultationRepo.getConsultationById(
        paymentOrder.consultationId
      );
    } catch (dbErr) {
      logger.error("Database error querying consultation for payment order", dbErr, {
        orderId: paymentOrder.id,
        consultationId: paymentOrder.consultationId,
      });
      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Failed to query consultation record.",
        orderId: paymentOrder.id,
      };
    }

    if (!consultation) {
      logger.error("Consultation record not found for payment order", {
        orderId: paymentOrder.id,
        consultationId: paymentOrder.consultationId,
      });
      return {
        success: false,
        error: "CONSULTATION_NOT_FOUND",
        message: `Consultation record "${paymentOrder.consultationId}" not found.`,
        orderId: paymentOrder.id,
      };
    }

    if (!consultation.slotId) {
      logger.error("Consultation has no associated slot ID", {
        orderId: paymentOrder.id,
        consultationId: consultation.id,
      });
      return {
        success: false,
        error: "CONSULTATION_HAS_NO_SLOT",
        message: `Consultation "${consultation.id}" does not have an associated slot.`,
        orderId: paymentOrder.id,
      };
    }

    if (!paymentOrder.reservationToken) {
      logger.error("Payment order missing required reservation token", {
        orderId: paymentOrder.id,
        consultationId: consultation.id,
      });
      return {
        success: false,
        error: "MISSING_RESERVATION_TOKEN",
        message: `Payment order "${paymentOrder.id}" is missing the reservation token.`,
        orderId: paymentOrder.id,
      };
    }
    const validatedReservationToken = paymentOrder.reservationToken;

    // Record / Ensure SUCCESS transaction
    let transaction: PaymentTransactionRecord | null = null;
    if (event.gatewayPaymentId) {
      try {
        transaction = await this.paymentTransactionRepo.getTransactionByGatewayId(
          event.gatewayPaymentId
        );
      } catch (err) {
        logger.error("Database error checking existing transaction", err, {
          orderId: paymentOrder.id,
        });
      }
    }

    if (!transaction) {
      try {
        transaction = await this.paymentTransactionRepo.recordTransaction({
          paymentOrderId: paymentOrder.id,
          gatewayPaymentId: event.gatewayPaymentId,
          amountInPaise: event.amountInPaise,
          status: "success",
          paymentMethod: normalizePaymentMethod(event.paymentMethod),
          bankReference: event.bankReference,
          errorCode: event.errorCode,
          errorDescription: event.errorDescription,
        });
      } catch (err) {
        const isConflict =
          (err as { code?: string })?.code === "23505" ||
          String(err).includes("23505") ||
          String(err).includes("duplicate key");
        if (isConflict && event.gatewayPaymentId) {
          transaction = await this.paymentTransactionRepo.getTransactionByGatewayId(
            event.gatewayPaymentId
          );
        }
        if (!transaction) {
          logger.error("Failed to record success payment transaction", err, {
            orderId: paymentOrder.id,
          });
          return {
            success: false,
            error: "DATABASE_ERROR",
            message: "Failed to persist payment transaction.",
            orderId: paymentOrder.id,
          };
        }
      }
    }

    const orderWasAlreadyPaid = paymentOrder.status === "paid";

    // Mark payment order as 'paid' if not already marked
    if (!orderWasAlreadyPaid) {
      try {
        paymentOrder = await this.paymentOrderRepo.updateOrderStatus(
          paymentOrder.id,
          "paid",
          {
            paidAt: event.eventTime || new Date().toISOString(),
          }
        );
      } catch (err) {
        logger.error("Database error transitioning payment order to paid", err, {
          orderId: paymentOrder.id,
        });
        return {
          success: false,
          error: "DATABASE_ERROR",
          message: "Failed to update payment order status to paid.",
          orderId: paymentOrder.id,
        };
      }
    }

    // Idempotent completion check: If consultation already confirmed
    if (consultation.status === "confirmed") {
      return {
        success: true,
        outcome: "duplicate",
        orderId: paymentOrder.id,
        consultationId: consultation.id,
        transactionId: transaction?.id,
        slotId: consultation.slotId,
        message: "Payment order is already paid and consultation is confirmed.",
      };
    }

    // Idempotent conflict check: If consultation already in slot conflict
    if (consultation.status === "slot_conflict_pending_reschedule") {
      return {
        success: true,
        outcome: "slot_conflict",
        orderId: paymentOrder.id,
        consultationId: consultation.id,
        transactionId: transaction?.id,
        slotId: consultation.slotId,
        message: "Payment is paid, but consultation remains pending reschedule due to slot conflict.",
      };
    }

    // --------------------------------------------------------------------------
    // 6. Slot Confirmation: STRICTLY Using paymentOrder.reservationToken
    // --------------------------------------------------------------------------
    let confirmedSlot = null;
    try {
      confirmedSlot = await this.slotRepo.confirmSlot(
        consultation.slotId,
        validatedReservationToken
      );
    } catch (slotErr) {
      logger.error("Database error executing confirmSlot RPC", slotErr, {
        slotId: consultation.slotId,
        orderId: paymentOrder.id,
      });
      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Database error during slot confirmation.",
        orderId: paymentOrder.id,
      };
    }

    // Slot confirmed successfully
    if (confirmedSlot) {
      try {
        consultation = await this.consultationRepo.updateConsultationStatus(
          consultation.id,
          "confirmed"
        );
      } catch (statusErr) {
        logger.error("Database error transitioning consultation to confirmed", statusErr, {
          consultationId: consultation.id,
          slotId: consultation.slotId,
        });
        return {
          success: false,
          error: "DATABASE_ERROR",
          message: "Failed to update consultation status to confirmed.",
          orderId: paymentOrder.id,
        };
      }

      return {
        success: true,
        outcome: "confirmed",
        orderId: paymentOrder.id,
        consultationId: consultation.id,
        transactionId: transaction?.id,
        slotId: consultation.slotId,
        message: "Payment confirmed and consultation slot booked successfully.",
      };
    }

    // --------------------------------------------------------------------------
    // 7. Partial-Failure Recovery on Retry
    // If order was already marked paid in a prior execution, check if the slot
    // was booked by this consultation before a transient crash occurred.
    // --------------------------------------------------------------------------
    if (orderWasAlreadyPaid) {
      let currentSlot = null;
      try {
        currentSlot = await this.slotRepo.getSlotById(consultation.slotId);
      } catch (fetchSlotErr) {
        logger.error("Database error inspecting slot status during recovery", fetchSlotErr, {
          slotId: consultation.slotId,
        });
      }

      if (currentSlot && currentSlot.status === "booked") {
        try {
          consultation = await this.consultationRepo.updateConsultationStatus(
            consultation.id,
            "confirmed"
          );
          return {
            success: true,
            outcome: "confirmed",
            orderId: paymentOrder.id,
            consultationId: consultation.id,
            transactionId: transaction?.id,
            slotId: consultation.slotId,
            message: "Consultation confirmed on retry after slot was previously booked.",
          };
        } catch (confErr) {
          logger.warn("Slot already confirmed by another consultation; routing to conflict", {
            consultationId: consultation.id,
            slotId: consultation.slotId,
            error: confErr instanceof Error ? confErr.message : String(confErr),
          });
        }
      }
    }

    // --------------------------------------------------------------------------
    // 8. Slot Conflict: Token Mismatch or Slot Claimed by Another Customer
    // --------------------------------------------------------------------------
    try {
      consultation = await this.consultationRepo.updateConsultationStatus(
        consultation.id,
        "slot_conflict_pending_reschedule"
      );
    } catch (conflictErr) {
      logger.error("Database error transitioning consultation to slot conflict", conflictErr, {
        consultationId: consultation.id,
        orderId: paymentOrder.id,
      });
      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Failed to transition consultation to slot conflict.",
        orderId: paymentOrder.id,
      };
    }

    return {
      success: true,
      outcome: "slot_conflict",
      orderId: paymentOrder.id,
      consultationId: consultation.id,
      transactionId: transaction?.id,
      slotId: consultation.slotId,
      message: "Slot confirmation failed; reservation token mismatch or slot claimed by another customer.",
    };
  }
}

export const paymentConfirmationService = new PaymentConfirmationService();
