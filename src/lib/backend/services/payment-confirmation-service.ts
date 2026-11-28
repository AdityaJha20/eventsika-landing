/**
 * Payment Confirmation Domain Service (provider-neutral).
 *
 * The ONE place where a verified provider payment becomes Eventsika financial and
 * booking state. Called by:
 *   - the verified Razorpay Checkout callback   (verifyCheckoutCallback)
 *   - the verified Razorpay webhook             (applyPaymentEvent)
 *   - reconciliation / status recovery          (syncOrderWithProvider)
 *   - the legacy Cashfree webhook               (processPaymentWebhook)
 *
 * All state changes happen inside the `apply_payment_event` PostgreSQL function:
 * transaction ledger, monotonic order status, and booking confirmation or
 * slot-conflict recovery are one atomic step. Payment state and consultation state
 * stay independent: a captured payment can coexist with
 * 'slot_conflict_pending_reschedule' (locked Eventsika rule, no automatic refund).
 */

import crypto from "node:crypto";
import { logger } from "../logger/logger";
import { getServerConfig } from "../config/env";
import { IPaymentOrderRepository } from "../repositories/payment-order-repository.interface";
import { SupabasePaymentOrderRepository } from "../repositories/supabase-payment-order-repository";
import {
  ApplyPaymentOutcome,
  IPaymentLedgerRepository,
  LedgerPaymentStatus,
  SupabasePaymentLedgerRepository,
} from "../repositories/payment-ledger-repository";
import { IOrderPaymentGateway, ProviderPayment } from "../integrations/payment-gateway.interface";
import { RazorpayPaymentGateway } from "../integrations/razorpay-payment-gateway";
import { verifyRazorpayCheckoutSignature } from "../security/razorpay-signature";
import { toLedgerPaymentStatus } from "../domain/razorpay-webhook";
import { NormalizedCashfreePaymentWebhook } from "../domain/webhook-types";
import { PaymentOrderRecord, PaymentProvider } from "../types/payment-and-consultation";

export interface NormalizedPaymentEvent {
  provider: PaymentProvider;
  gatewayOrderId: string;
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

export type PaymentConfirmationOutcome = Exclude<
  ApplyPaymentOutcome,
  "order_not_found" | "amount_mismatch" | "currency_mismatch"
>;

export type PaymentConfirmationErrorCode =
  | "ORDER_NOT_FOUND"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "UNSUPPORTED_EVENT_TYPE"
  | "DATABASE_ERROR"
  | "GATEWAY_ERROR";

export interface PaymentConfirmationSuccess {
  success: true;
  outcome: PaymentConfirmationOutcome;
  orderId: string;
  consultationId: string;
  transactionId?: string;
  message?: string;
}

export interface PaymentConfirmationFailure {
  success: false;
  error: PaymentConfirmationErrorCode;
  message: string;
  orderId?: string;
}

export type PaymentConfirmationResult = PaymentConfirmationSuccess | PaymentConfirmationFailure;

/** Errors worth a provider retry (webhook 5xx); everything else is terminal. */
export function isTransientConfirmationError(code: PaymentConfirmationErrorCode): boolean {
  return code === "DATABASE_ERROR" || code === "GATEWAY_ERROR";
}

/** Outcomes after which the customer has paid (receipt-worthy). */
export function isPaidOutcome(outcome: PaymentConfirmationOutcome): boolean {
  return outcome === "confirmed" || outcome === "already_confirmed" || outcome === "slot_conflict";
}

export function normalizePaymentMethod(method: string | null | undefined): string | null {
  if (!method) return null;
  const lower = method.toLowerCase();
  if (lower.includes("upi")) return "upi";
  if (lower.includes("card") || lower.includes("credit") || lower.includes("debit") || lower === "emi") return "card";
  if (lower.includes("netbanking") || lower === "nb") return "netbanking";
  if (lower.includes("wallet")) return "wallet";
  return null;
}

function timingSafeTokenCompare(a: string | null, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export type CheckoutVerificationError =
  | "ORDER_NOT_FOUND"
  | "INVALID_RESERVATION_TOKEN"
  | "SIGNATURE_INVALID"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_ORDER_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "GATEWAY_ERROR"
  | "DATABASE_ERROR"
  | "NOT_CONFIGURED";

export type CheckoutVerificationResult =
  | { success: true; outcome: PaymentConfirmationOutcome | "payment_not_completed"; orderId: string; consultationId: string }
  | { success: false; error: CheckoutVerificationError; message: string };

export class PaymentConfirmationService {
  private paymentOrderRepo: IPaymentOrderRepository;
  private ledger: IPaymentLedgerRepository;
  private gateway: IOrderPaymentGateway;
  private keySecretResolver: () => string | undefined;

  constructor(deps?: {
    paymentOrderRepo?: IPaymentOrderRepository;
    ledger?: IPaymentLedgerRepository;
    gateway?: IOrderPaymentGateway;
    keySecretResolver?: () => string | undefined;
  }) {
    this.paymentOrderRepo = deps?.paymentOrderRepo || new SupabasePaymentOrderRepository();
    this.ledger = deps?.ledger || new SupabasePaymentLedgerRepository();
    this.gateway = deps?.gateway || new RazorpayPaymentGateway();
    this.keySecretResolver =
      deps?.keySecretResolver ||
      (() => {
        const cfg = getServerConfig().razorpay;
        return cfg.isConfigured ? cfg.keySecret : undefined;
      });
  }

  /**
   * Finds the local order for a provider order ID. For Razorpay, an order whose
   * creation response was lost (gateway_order_id still empty) is recovered through
   * the provider order's receipt and linked exactly once.
   */
  async resolveOrder(provider: PaymentProvider, gatewayOrderId: string): Promise<PaymentOrderRecord | null> {
    const direct = await this.paymentOrderRepo.getOrderByProviderGatewayId(provider, gatewayOrderId);
    if (direct || provider !== "razorpay") return direct;

    const remote = await this.gateway.fetchOrder(gatewayOrderId);
    if (!remote?.receipt) return null;
    const local = await this.paymentOrderRepo.getOrderByReceipt(remote.receipt);
    if (!local || local.provider !== "razorpay") return null;
    if (local.gatewayOrderId === gatewayOrderId) return local;
    if (local.gatewayOrderId) return null; // linked to a different provider order: never re-link
    return this.paymentOrderRepo.attachGatewayOrderId(local.id, gatewayOrderId);
  }

  async applyPaymentEvent(event: NormalizedPaymentEvent): Promise<PaymentConfirmationResult> {
    let order: PaymentOrderRecord | null;
    try {
      order = await this.resolveOrder(event.provider, event.gatewayOrderId);
    } catch (err) {
      logger.error("Failed to resolve payment order for provider event", err, {
        provider: event.provider,
        gatewayOrderId: event.gatewayOrderId,
      });
      return { success: false, error: "DATABASE_ERROR", message: "Failed to resolve payment order." };
    }

    if (!order) {
      logger.warn("Provider payment event for an unknown order", {
        provider: event.provider,
        gatewayOrderId: event.gatewayOrderId,
        gatewayPaymentId: event.gatewayPaymentId,
      });
      try {
        await this.ledger.recordIssue({
          provider: event.provider,
          kind: "unknown_gateway_order",
          gatewayReference: event.gatewayPaymentId ?? event.gatewayOrderId,
          detail: `status=${event.status} amount=${event.amountInPaise} ${event.currency} order=${event.gatewayOrderId}`,
        });
      } catch (issueErr) {
        logger.error("Failed to record unknown-order payment issue", issueErr, {
          gatewayOrderId: event.gatewayOrderId,
        });
      }
      return { success: false, error: "ORDER_NOT_FOUND", message: "Payment order not found." };
    }

    let applied;
    try {
      applied = await this.ledger.applyPaymentEvent({
        paymentOrderId: order.id,
        gatewayPaymentId: event.gatewayPaymentId,
        status: event.status,
        amountInPaise: event.amountInPaise,
        currency: event.currency,
        paymentMethod: normalizePaymentMethod(event.paymentMethod),
        bankReference: event.bankReference ?? null,
        errorCode: event.errorCode?.slice(0, 50) ?? null,
        errorDescription: event.errorDescription?.slice(0, 500) ?? null,
        eventTime: event.eventTime ?? null,
      });
    } catch (err) {
      logger.error("apply_payment_event failed", err, { orderId: order.id, status: event.status });
      return { success: false, error: "DATABASE_ERROR", message: "Failed to apply payment event.", orderId: order.id };
    }

    switch (applied.outcome) {
      case "order_not_found":
        return { success: false, error: "ORDER_NOT_FOUND", message: "Payment order not found.", orderId: order.id };
      case "amount_mismatch":
        logger.warn("Payment amount mismatch recorded as payment issue", { orderId: order.id });
        return { success: false, error: "AMOUNT_MISMATCH", message: "Payment amount does not match the order.", orderId: order.id };
      case "currency_mismatch":
        logger.warn("Payment currency mismatch recorded as payment issue", { orderId: order.id });
        return { success: false, error: "CURRENCY_MISMATCH", message: "Payment currency does not match the order.", orderId: order.id };
      default:
        logger.info("Payment event applied", {
          orderId: order.id,
          provider: event.provider,
          status: event.status,
          outcome: applied.outcome,
        });
        return {
          success: true,
          outcome: applied.outcome,
          orderId: order.id,
          consultationId: order.consultationId,
          transactionId: applied.transactionId ?? undefined,
        };
    }
  }

  /** Applies one provider payment fetched from (or verified by) Razorpay. */
  async applyProviderPayment(payment: ProviderPayment, eventTime?: string | null): Promise<PaymentConfirmationResult | null> {
    const status = toLedgerPaymentStatus(payment.status);
    if (!status || !payment.orderId) return null;
    return this.applyPaymentEvent({
      provider: "razorpay",
      gatewayOrderId: payment.orderId,
      gatewayPaymentId: payment.id,
      status,
      amountInPaise: payment.amountInPaise,
      currency: payment.currency,
      paymentMethod: payment.method,
      bankReference: payment.bankReference,
      errorCode: payment.errorCode,
      errorDescription: payment.errorDescription,
      eventTime: eventTime ?? null,
    });
  }

  /**
   * Pulls authoritative payment state for one Razorpay order and applies it.
   * Used by customer status recovery and reconciliation. Returns the most
   * significant result (captured beats failed), or null when nothing happened yet.
   */
  async syncOrderWithProvider(order: PaymentOrderRecord): Promise<PaymentConfirmationResult | null> {
    if (order.provider !== "razorpay") return null;

    let gatewayOrderId = order.gatewayOrderId;
    if (!gatewayOrderId) {
      if (!order.receipt) return null;
      const remote = await this.gateway.findOrderByReceipt(order.receipt);
      if (!remote) return null; // never created at Razorpay: nothing can have been paid
      gatewayOrderId = (await this.paymentOrderRepo.attachGatewayOrderId(order.id, remote.id)).gatewayOrderId;
      if (!gatewayOrderId) return null;
    }

    const payments = await this.gateway.fetchOrderPayments(gatewayOrderId);
    const rank = (p: ProviderPayment) => (toLedgerPaymentStatus(p.status) === "captured" ? 2 : p.status === "authorized" ? 1 : 0);
    let best: PaymentConfirmationResult | null = null;
    for (const payment of [...payments].sort((a, b) => rank(a) - rank(b))) {
      if (payment.orderId !== gatewayOrderId) continue;
      const result = await this.applyProviderPayment(payment);
      if (result) best = result;
    }
    return best;
  }

  /**
   * Verifies a Razorpay Checkout success callback. The browser supplies only IDs and
   * a signature; the trusted order ID comes from the database, the payment status
   * from the Razorpay API. A valid signature alone never confirms anything.
   */
  async verifyCheckoutCallback(input: {
    consultationId: string;
    reservationToken: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<CheckoutVerificationResult> {
    const keySecret = this.keySecretResolver();
    if (!keySecret) {
      return { success: false, error: "NOT_CONFIGURED", message: "Payment verification is temporarily unavailable." };
    }

    let order: PaymentOrderRecord | null;
    try {
      order = await this.paymentOrderRepo.getLatestOrderByConsultationId(input.consultationId);
    } catch (err) {
      logger.error("Failed to load order for checkout verification", err, { consultationId: input.consultationId });
      return { success: false, error: "DATABASE_ERROR", message: "Unable to verify payment right now." };
    }

    if (!order || order.provider !== "razorpay" || !order.gatewayOrderId) {
      return { success: false, error: "ORDER_NOT_FOUND", message: "No matching payment order was found." };
    }
    if (!timingSafeTokenCompare(order.reservationToken, input.reservationToken)) {
      return { success: false, error: "INVALID_RESERVATION_TOKEN", message: "This payment cannot be verified for this booking." };
    }

    const signatureValid =
      input.razorpayOrderId === order.gatewayOrderId &&
      verifyRazorpayCheckoutSignature({
        trustedOrderId: order.gatewayOrderId,
        paymentId: input.razorpayPaymentId,
        signature: input.razorpaySignature,
        keySecret,
      });
    if (!signatureValid) {
      logger.warn("Checkout signature verification failed", { orderId: order.id });
      return { success: false, error: "SIGNATURE_INVALID", message: "Payment verification failed." };
    }

    let payment: ProviderPayment | null;
    try {
      payment = await this.gateway.fetchPayment(input.razorpayPaymentId);
    } catch (err) {
      logger.error("Failed to fetch payment from Razorpay during checkout verification", err, { orderId: order.id });
      return { success: false, error: "GATEWAY_ERROR", message: "Payment is being verified. Please do not pay again." };
    }
    if (!payment) {
      return { success: false, error: "PAYMENT_NOT_FOUND", message: "Payment is being verified. Please do not pay again." };
    }
    if (payment.orderId !== order.gatewayOrderId) {
      logger.warn("Checkout payment belongs to a different order", { orderId: order.id });
      return { success: false, error: "PAYMENT_ORDER_MISMATCH", message: "Payment verification failed." };
    }

    const result = await this.applyProviderPayment(payment);
    if (!result) {
      return { success: true, outcome: "payment_not_completed", orderId: order.id, consultationId: order.consultationId };
    }
    if (!result.success) {
      const error: CheckoutVerificationError =
        result.error === "AMOUNT_MISMATCH" || result.error === "CURRENCY_MISMATCH" ? result.error : "DATABASE_ERROR";
      return { success: false, error, message: "Payment is being verified. Please do not pay again." };
    }
    return { success: true, outcome: result.outcome, orderId: result.orderId, consultationId: result.consultationId };
  }

  /**
   * Legacy Cashfree webhook path. Historical Cashfree orders stay processable through
   * the same atomic ledger function as Razorpay.
   */
  async processPaymentWebhook(event: NormalizedCashfreePaymentWebhook): Promise<PaymentConfirmationResult> {
    const status: LedgerPaymentStatus | null =
      event.eventType === "PAYMENT_SUCCESS_WEBHOOK"
        ? "captured"
        : event.eventType === "PAYMENT_FAILED_WEBHOOK"
          ? "failed"
          : event.eventType === "PAYMENT_USER_DROPPED_WEBHOOK"
            ? "user_dropped"
            : null;
    if (!status) {
      return { success: false, error: "UNSUPPORTED_EVENT_TYPE", message: `Unsupported event type: "${event.eventType}"` };
    }
    return this.applyPaymentEvent({
      provider: "cashfree",
      gatewayOrderId: event.orderId,
      gatewayPaymentId: event.gatewayPaymentId,
      status,
      amountInPaise: event.amountInPaise,
      currency: event.currency,
      paymentMethod: event.paymentMethod,
      bankReference: event.bankReference,
      errorCode: event.errorCode,
      errorDescription: event.errorDescription,
      eventTime: event.eventTime,
    });
  }
}

export const paymentConfirmationService = new PaymentConfirmationService();
