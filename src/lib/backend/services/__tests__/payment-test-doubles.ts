/**
 * Shared vitest doubles for payment service suites (not a test file itself).
 */
import { vi } from "vitest";
import { IPaymentOrderRepository } from "../../repositories/payment-order-repository.interface";
import { IPaymentTransactionRepository } from "../../repositories/payment-transaction-repository.interface";
import { IPaymentRefundRepository } from "../../repositories/payment-refund-repository.interface";
import { IConsultationRepository } from "../../repositories/consultation-repository.interface";
import { IConsultationSlotRepository } from "../../repositories/consultation-slot-repository.interface";
import { IWebhookEventRepository } from "../../repositories/webhook-event-repository.interface";
import { IPaymentLedgerRepository } from "../../repositories/payment-ledger-repository";
import { IOrderPaymentGateway } from "../../integrations/payment-gateway.interface";
import {
  ConsultationRecord,
  ConsultationSlotRecord,
  PaymentOrderRecord,
  PaymentRefundRecord,
  PaymentTransactionRecord,
} from "../../types/payment-and-consultation";

export const TOKEN = "a".repeat(64);
export const CONSULTATION_ID = "22222222-2222-4222-8222-222222222222";
export const ORDER_ID = "11111111-1111-4111-8111-111111111111";
export const SLOT_ID = "44444444-4444-4444-8444-444444444444";

export const anOrder = (o: Partial<PaymentOrderRecord> = {}): PaymentOrderRecord => ({
  id: ORDER_ID,
  consultationId: CONSULTATION_ID,
  provider: "razorpay",
  gatewayOrderId: "order_TestOrder0001",
  receipt: "rcpt_22222222222242228222222222222222",
  amountInPaise: 299900,
  currency: "INR",
  status: "paid",
  expiresAt: null,
  paidAt: "2026-10-01T10:02:00.000Z",
  reservationToken: TOKEN,
  requestId: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:02:00.000Z",
  ...o,
});

export const aTransaction = (o: Partial<PaymentTransactionRecord> = {}): PaymentTransactionRecord => ({
  id: "33333333-3333-4333-8333-333333333333",
  paymentOrderId: ORDER_ID,
  provider: "razorpay",
  gatewayPaymentId: "pay_TestPayment01",
  amountInPaise: 299900,
  feeInPaise: null,
  taxInPaise: null,
  status: "success",
  paymentMethod: "upi",
  bankReference: null,
  errorCode: null,
  errorDescription: null,
  createdAt: "2026-10-01T10:02:00.000Z",
  ...o,
});

export const aRefund = (o: Partial<PaymentRefundRecord> = {}): PaymentRefundRecord => ({
  id: "55555555-5555-4555-8555-555555555555",
  paymentOrderId: ORDER_ID,
  paymentTransactionId: "33333333-3333-4333-8333-333333333333",
  consultationId: CONSULTATION_ID,
  provider: "razorpay",
  gatewayRefundId: null,
  idempotencyKey: "rf_0123456789abcdef0123456789abcdef01234567",
  lastError: null,
  requestedBy: "admin-1",
  requestId: "req-1",
  amountInPaise: 299900,
  status: "pending",
  reason: "customer_cancellation: requested by email",
  initiatedBy: "admin",
  processedAt: null,
  createdAt: "2026-10-01T11:00:00.000Z",
  updatedAt: "2026-10-01T11:00:00.000Z",
  ...o,
});

export const aConsultation = (o: Partial<ConsultationRecord> = {}): ConsultationRecord => ({
  id: CONSULTATION_ID,
  slotId: SLOT_ID,
  customerFirstName: "Asha",
  customerLastName: "Rao",
  customerPhone: "9876543210",
  customerEmail: "asha@example.com",
  customerCity: "Pune",
  eventType: "Birthday",
  eventTypeOther: null,
  guestCount: null,
  eventDateApprox: null,
  meetingChannel: "video",
  status: "confirmed",
  cancellationReason: null,
  rescheduledFromId: null,
  rescheduleCount: 0,
  requestId: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:02:00.000Z",
  ...o,
});

export const aSlot = (o: Partial<ConsultationSlotRecord> = {}): ConsultationSlotRecord => ({
  id: SLOT_ID,
  startTime: "2026-10-05T04:30:00.000Z", // 10:00 IST
  endTime: "2026-10-05T05:30:00.000Z",
  status: "booked",
  reservedUntil: null,
  reservationToken: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:02:00.000Z",
  ...o,
});

export function mockOrderRepo(order = anOrder()): IPaymentOrderRepository {
  return {
    createOrder: vi.fn(),
    getOrderById: vi.fn().mockResolvedValue(order),
    getOrderByGatewayId: vi.fn().mockResolvedValue(order),
    getOrderByProviderGatewayId: vi.fn().mockResolvedValue(order),
    getOrderByReceipt: vi.fn().mockResolvedValue(order),
    attachGatewayOrderId: vi.fn(),
    updateOrderStatus: vi.fn(),
    getLatestOrderByConsultationId: vi.fn().mockResolvedValue(order),
    listOpenOrders: vi.fn().mockResolvedValue([]),
  };
}

export function mockTransactionRepo(txns = [aTransaction()]): IPaymentTransactionRepository {
  return {
    recordTransaction: vi.fn(),
    getTransactionById: vi.fn().mockResolvedValue(txns[0] ?? null),
    getTransactionByGatewayId: vi.fn().mockResolvedValue(txns[0] ?? null),
    getTransactionsByOrderId: vi.fn().mockResolvedValue(txns),
  };
}

export function mockRefundRepo(refunds: PaymentRefundRecord[] = []): IPaymentRefundRepository {
  return {
    createRefund: vi.fn(),
    getRefundById: vi.fn().mockResolvedValue(refunds[0] ?? null),
    getRefundsByOrderId: vi.fn().mockResolvedValue(refunds),
    updateRefundStatus: vi.fn().mockImplementation(async (id: string, status: PaymentRefundRecord["status"], d?: { gatewayRefundId?: string | null }) =>
      aRefund({ id, status, gatewayRefundId: d?.gatewayRefundId ?? null })
    ),
    getRefundByGatewayId: vi.fn().mockResolvedValue(null),
    listOpenRefunds: vi.fn().mockResolvedValue([]),
  };
}

export function mockConsultationRepo(c = aConsultation()): IConsultationRepository {
  return {
    createConsultation: vi.fn(),
    getConsultationById: vi.fn().mockResolvedValue(c),
    updateConsultationStatus: vi.fn(),
    detachStaleSlotHold: vi.fn(),
  };
}

export function mockSlotRepo(slot = aSlot()): IConsultationSlotRepository {
  return {
    createSlot: vi.fn(),
    getSlotById: vi.fn().mockResolvedValue(slot),
    getSlotsByTimeRange: vi.fn(),
    updateSlotStatus: vi.fn(),
    getAvailableSlots: vi.fn(),
    bulkCreateSlots: vi.fn(),
    reserveSlot: vi.fn(),
    releaseSlot: vi.fn(),
    confirmSlot: vi.fn(),
  };
}

export function mockLedger(): IPaymentLedgerRepository {
  return {
    applyPaymentEvent: vi.fn(),
    createRefundIntent: vi.fn().mockResolvedValue(aRefund()),
    rebookConflictedConsultation: vi.fn().mockResolvedValue("rebooked"),
    claimNotification: vi.fn().mockImplementation(async (req: { dedupeKey: string; kind: string }) => ({
      id: "66666666-6666-4666-8666-666666666666",
      dedupeKey: req.dedupeKey,
      kind: req.kind,
      attempts: 1,
    })),
    completeNotification: vi.fn().mockResolvedValue(undefined),
    listRetryableNotifications: vi.fn().mockResolvedValue([]),
    recordIssue: vi.fn().mockResolvedValue(undefined),
    resolveIssue: vi.fn(),
    listOpenIssues: vi.fn().mockResolvedValue([]),
    appendAudit: vi.fn().mockResolvedValue(undefined),
  };
}

export function mockGateway(): IOrderPaymentGateway {
  return {
    provider: "razorpay",
    createOrder: vi.fn(),
    fetchOrder: vi.fn(),
    findOrderByReceipt: vi.fn(),
    fetchOrderPayments: vi.fn().mockResolvedValue([]),
    fetchPayment: vi.fn(),
    createRefund: vi.fn().mockResolvedValue({ id: "rfnd_TestRefund01", paymentId: "pay_TestPayment01", amountInPaise: 299900, status: "pending" }),
    fetchRefund: vi.fn(),
    fetchPaymentRefunds: vi.fn().mockResolvedValue([]),
  };
}

export function mockWebhookRepo(): IWebhookEventRepository {
  return {
    recordWebhookEvent: vi.fn(),
    getWebhookEvent: vi.fn(),
    updateWebhookEventStatus: vi.fn(),
    claimWebhookEvent: vi.fn(),
    listRetryableEvents: vi.fn().mockResolvedValue([]),
  };
}
