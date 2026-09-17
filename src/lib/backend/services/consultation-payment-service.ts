/**
 * Consultation Payment Domain Service (Step 4)
 *
 * Orchestrates secure payment order creation connecting:
 * Existing Consultation Reservation (status: 'slot_held')
 *   ↓
 * Server-Authoritative Validation (Slot, Token, 120s Safety Lifetime, Price)
 *   ↓
 * Cashfree Create / Recover (Deterministic Order ID, 10s Timeout, 409 Auto-Recovery)
 *   ↓
 * Local payment_orders Persistence (status: 'created', gateway_order_id populated)
 *   ↓
 * Consultation State Transition ('slot_held' → 'awaiting_payment')
 *   ↓
 * Return paymentSessionId for Client Checkout (Step 5)
 */

import crypto from "node:crypto";
import { logger } from "../logger/logger";
import { IConsultationSlotRepository } from "../repositories/consultation-slot-repository.interface";
import { SupabaseConsultationSlotRepository } from "../repositories/supabase-consultation-slot-repository";
import { IConsultationRepository } from "../repositories/consultation-repository.interface";
import { SupabaseConsultationRepository } from "../repositories/supabase-consultation-repository";
import { IPaymentOrderRepository } from "../repositories/payment-order-repository.interface";
import { SupabasePaymentOrderRepository } from "../repositories/supabase-payment-order-repository";
import {
  GatewayError,
  GatewayOrderResult,
  IPaymentGatewayAdapter,
} from "../integrations/payment-gateway.interface";
import { CashfreePaymentGatewayAdapter } from "../integrations/cashfree-payment-gateway-adapter";
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
  | "PAYMENT_ORDER_EXPIRED"
  | "GATEWAY_TIMEOUT"
  | "GATEWAY_ERROR"
  | "DATABASE_ERROR";

export interface CreatePaymentOrderSuccess {
  success: true;
  data: {
    paymentSessionId: string;
    orderId: string;
    amountInPaise: number;
    currency: "INR";
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
 * Constructs a deterministic Cashfree merchant order ID from consultation UUID.
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
  private gatewayAdapter: IPaymentGatewayAdapter;

  constructor(
    slotRepo?: IConsultationSlotRepository,
    consultationRepo?: IConsultationRepository,
    paymentOrderRepo?: IPaymentOrderRepository,
    gatewayAdapter?: IPaymentGatewayAdapter
  ) {
    this.slotRepo = slotRepo || new SupabaseConsultationSlotRepository();
    this.consultationRepo = consultationRepo || new SupabaseConsultationRepository();
    this.paymentOrderRepo = paymentOrderRepo || new SupabasePaymentOrderRepository();
    this.gatewayAdapter = gatewayAdapter || new CashfreePaymentGatewayAdapter();
  }

  /**
   * Secure Order Creation Pipeline:
   * 1. Pre-gateway authoritative validation (Consultation, Slot, Token, Expiry >= 120s).
   * 2. Inspect existing local payment orders (paid check, recovery of active orders).
   * 3. Gateway-First: Create/Recover Cashfree order with deterministic ID.
   * 4. Post-gateway expiry check (prevent issuing session if slot expired during call).
   * 5. Persist local payment_orders row (handling PostgreSQL 23505 unique collision).
   * 6. Transition consultation: 'slot_held' -> 'awaiting_payment'.
   * 7. Return paymentSessionId.
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
    // Step 8: Inspect Existing Payment Orders (Concurrency & Idempotency)
    // --------------------------------------------------------------------------
    const deterministicOrderId = buildDeterministicGatewayOrderId(consultation.id);

    let existingOrder: PaymentOrderRecord | null = null;
    try {
      existingOrder = await this.paymentOrderRepo.getLatestOrderByConsultationId(consultation.id);
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

    if (existingOrder) {
      if (existingOrder.status === "paid") {
        return {
          success: false,
          error: "PAYMENT_ALREADY_COMPLETED",
          message: "Payment for this consultation has already been completed.",
        };
      }

      if (existingOrder.status === "created" || existingOrder.status === "attempted") {
        logger.info("Existing active payment order found; recovering provider order session", {
          requestId,
          consultationId: consultation.id,
          orderId: deterministicOrderId,
          localStatus: existingOrder.status,
        });

        let recoveredOrder: GatewayOrderResult | null = null;
        try {
          recoveredOrder = await this.gatewayAdapter.getOrder(deterministicOrderId);
        } catch (gwErr) {
          logger.error("Failed to query Cashfree for existing order recovery", gwErr, {
            requestId,
            orderId: deterministicOrderId,
          });
          return {
            success: false,
            error: "GATEWAY_ERROR",
            message: "Unable to retrieve payment session from payment gateway. Please try again.",
          };
        }

        if (!recoveredOrder) {
          logger.warn("Local payment order exists but Cashfree returned 404", {
            requestId,
            orderId: deterministicOrderId,
          });
          return {
            success: false,
            error: "GATEWAY_ERROR",
            message: "Existing payment session could not be recovered. Please try again.",
          };
        }

        if (recoveredOrder.orderStatus === "PAID") {
          try {
            await this.paymentOrderRepo.updateOrderStatus(existingOrder.id, "paid", {
              paidAt: new Date().toISOString(),
            });
          } catch (syncErr) {
            logger.warn("Failed to synchronize local order to paid status during recovery", {
              error: syncErr,
            });
          }
          return {
            success: false,
            error: "PAYMENT_ALREADY_COMPLETED",
            message: "Payment for this consultation has already been completed.",
          };
        }

        if (recoveredOrder.orderStatus === "EXPIRED" || recoveredOrder.orderStatus === "TERMINATED") {
          return {
            success: false,
            error: "PAYMENT_ORDER_EXPIRED",
            message: "The payment session has expired. Please choose a fresh consultation slot.",
          };
        }

        // Self-healing: if consultation is still 'slot_held', transition to 'awaiting_payment'
        if (consultation.status === "slot_held") {
          try {
            await this.consultationRepo.updateConsultationStatus(consultation.id, "awaiting_payment");
          } catch (transErr) {
            logger.warn("Warning updating consultation to awaiting_payment during recovery", {
              error: transErr,
            });
          }
        }

        return {
          success: true,
          data: {
            paymentSessionId: recoveredOrder.paymentSessionId,
            orderId: deterministicOrderId,
            amountInPaise: existingOrder.amountInPaise,
            currency: existingOrder.currency,
          },
        };
      }

      if (existingOrder.status === "failed" || existingOrder.status === "expired") {
        return {
          success: false,
          error: "PAYMENT_ORDER_EXPIRED",
          message: "The previous payment session failed or expired. Please select an available slot.",
        };
      }
    }

    // --------------------------------------------------------------------------
    // Step 9: Gateway-First Cashfree Order Creation / Auto-Recovery
    // --------------------------------------------------------------------------
    let gatewayResult: GatewayOrderResult;
    try {
      gatewayResult = await this.gatewayAdapter.createOrder({
        orderId: deterministicOrderId,
        amountInPaise: DEFAULT_CONSULTATION_PRICE_PAISE,
        currency: "INR",
        customer: {
          id: `cust_${consultation.id.replace(/-/g, "").slice(0, 16)}`,
          name: `${consultation.customerFirstName} ${consultation.customerLastName}`.trim() || null,
          email: consultation.customerEmail,
          phone: consultation.customerPhone,
        },
        orderExpiryTime: slot.reservedUntil,
        orderNote: "Eventsika Consultation Booking",
      });
    } catch (gwErr) {
      if (gwErr instanceof GatewayError) {
        if (gwErr.code === "GATEWAY_TIMEOUT") {
          logger.error("Cashfree gateway request timed out during order creation", gwErr, {
            requestId,
            orderId: deterministicOrderId,
          });
          return {
            success: false,
            error: "GATEWAY_TIMEOUT",
            message: "Payment provider timed out. Please try again.",
          };
        }

        logger.error("Cashfree gateway error during order creation", gwErr, {
          requestId,
          orderId: deterministicOrderId,
          code: gwErr.code,
        });
        return {
          success: false,
          error: "GATEWAY_ERROR",
          message: "Payment provider rejected order creation. Please try again.",
        };
      }

      logger.error("Unexpected error calling payment gateway", gwErr, {
        requestId,
        orderId: deterministicOrderId,
      });
      return {
        success: false,
        error: "GATEWAY_ERROR",
        message: "Failed to communicate with payment provider. Please try again.",
      };
    }

    // --------------------------------------------------------------------------
    // Step 10: Post-Gateway Expiry Verification
    // If the reservation expired while waiting for Cashfree, abort exposure.
    // --------------------------------------------------------------------------
    const postCheckNow = new Date();
    const postCheckRemaining = Math.floor(
      (new Date(slot.reservedUntil).getTime() - postCheckNow.getTime()) / 1000
    );

    if (postCheckRemaining <= 0) {
      logger.warn("Reservation expired during Cashfree order creation roundtrip", {
        requestId,
        consultationId: consultation.id,
        orderId: deterministicOrderId,
      });
      return {
        success: false,
        error: "RESERVATION_EXPIRED",
        message: "Your reservation hold expired during payment order preparation. Please select an available slot to reserve a fresh booking window.",
      };
    }

    // --------------------------------------------------------------------------
    // Step 11: Local payment_orders Row Persistence (Handling Concurrency 23505)
    // --------------------------------------------------------------------------
    let savedOrder: PaymentOrderRecord | null = null;
    try {
      savedOrder = await this.paymentOrderRepo.createOrder({
        consultationId: consultation.id,
        gatewayOrderId: gatewayResult.merchantOrderId,
        amountInPaise: DEFAULT_CONSULTATION_PRICE_PAISE,
        currency: "INR",
        expiresAt: slot.reservedUntil,
        requestId: requestId || null,
      });
    } catch (dbErr) {
      const errorMessage = dbErr instanceof Error ? dbErr.message : String(dbErr);
      const isUniqueConflict =
        (dbErr as { code?: string })?.code === "23505" ||
        errorMessage.includes("duplicate key") ||
        errorMessage.includes("23505");

      if (isUniqueConflict) {
        logger.info("Concurrent payment_orders insert collision detected; fetching winning record", {
          requestId,
          orderId: gatewayResult.merchantOrderId,
        });

        try {
          savedOrder = await this.paymentOrderRepo.getOrderByGatewayId(gatewayResult.merchantOrderId);
        } catch (fetchErr) {
          logger.error("Failed to fetch winning payment order after unique conflict", fetchErr, {
            requestId,
            orderId: gatewayResult.merchantOrderId,
          });
        }
      }

      if (!savedOrder) {
        logger.error("Failed to persist payment_orders record locally", dbErr, {
          requestId,
          consultationId: consultation.id,
          orderId: gatewayResult.merchantOrderId,
        });
        return {
          success: false,
          error: "DATABASE_ERROR",
          message: "Unable to record payment order locally. Please try again.",
        };
      }
    }

    // --------------------------------------------------------------------------
    // Step 12: Consultation State Transition ('slot_held' -> 'awaiting_payment')
    // --------------------------------------------------------------------------
    if (consultation.status === "slot_held") {
      try {
        await this.consultationRepo.updateConsultationStatus(
          consultation.id,
          "awaiting_payment"
        );
      } catch (statusErr) {
        logger.error(
          "Failed to transition consultation status to awaiting_payment after local order persistence",
          statusErr,
          {
            requestId,
            consultationId: consultation.id,
            orderId: savedOrder.id,
          }
        );
        return {
          success: false,
          error: "DATABASE_ERROR",
          message: "Unable to update consultation status. Please try again.",
        };
      }
    }

    // --------------------------------------------------------------------------
    // Step 13: Safely Return Checkout Session
    // --------------------------------------------------------------------------
    return {
      success: true,
      data: {
        paymentSessionId: gatewayResult.paymentSessionId,
        orderId: gatewayResult.merchantOrderId,
        amountInPaise: DEFAULT_CONSULTATION_PRICE_PAISE,
        currency: "INR",
      },
    };
  }
}

export const consultationPaymentService = new ConsultationPaymentService();
