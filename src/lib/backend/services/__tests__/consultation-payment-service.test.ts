import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConsultationPaymentService,
  buildDeterministicGatewayOrderId,
  buildRazorpayReceipt,
  MIN_RESERVATION_SAFETY_LIFETIME_SECONDS,
} from "../consultation-payment-service";
import { IConsultationSlotRepository } from "../../repositories/consultation-slot-repository.interface";
import { IConsultationRepository } from "../../repositories/consultation-repository.interface";
import { IPaymentOrderRepository } from "../../repositories/payment-order-repository.interface";
import { IPaymentTransactionRepository } from "../../repositories/payment-transaction-repository.interface";
import { IPaymentLedgerRepository } from "../../repositories/payment-ledger-repository";
import { GatewayError, IOrderPaymentGateway, ProviderOrder } from "../../integrations/payment-gateway.interface";
import {
  ConsultationRecord,
  ConsultationSlotRecord,
  PaymentOrderRecord,
  PaymentTransactionRecord,
} from "../../types/payment-and-consultation";

describe("ConsultationPaymentService (Razorpay order creation)", () => {
  const mockConsultationId = "c7c88b90-d461-4fa3-a75d-f152d113ba4c";
  const mockSlotId = "slot-uuid-999";
  const mockToken = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"; // 64 hex
  const receipt = buildRazorpayReceipt(mockConsultationId);

  // Baseline server timestamp: 2026-10-01T10:00:00.000Z
  const baselineNow = new Date("2026-10-01T10:00:00.000Z");

  const mockSlot: ConsultationSlotRecord = {
    id: mockSlotId,
    startTime: "2026-10-02T10:00:00.000Z",
    endTime: "2026-10-02T11:00:00.000Z",
    status: "reserved",
    // 15 minutes hold: 10:15:00.000Z (900s remaining at baselineNow)
    reservedUntil: "2026-10-01T10:15:00.000Z",
    reservationToken: mockToken,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  };

  const mockConsultation: ConsultationRecord = {
    id: mockConsultationId,
    slotId: mockSlotId,
    customerFirstName: "Ananya",
    customerLastName: "Roy",
    customerPhone: "9876543210",
    customerEmail: "ananya.roy@example.com",
    customerCity: "Kolkata",
    eventType: "Birthday",
    eventTypeOther: null,
    guestCount: "20",
    eventDateApprox: "November 2026",
    meetingChannel: "video",
    status: "slot_held",
    cancellationReason: null,
    rescheduledFromId: null,
    rescheduleCount: 0,
    requestId: "req_test_123",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  };

  const remoteOrder: ProviderOrder = {
    id: "order_TestOrder0001",
    amountInPaise: 299900,
    currency: "INR",
    receipt,
    status: "created",
  };

  const localOrder: PaymentOrderRecord = {
    id: "order-local-uuid-1",
    consultationId: mockConsultationId,
    provider: "razorpay",
    gatewayOrderId: null,
    receipt,
    amountInPaise: 299900,
    currency: "INR",
    status: "created",
    expiresAt: "2026-10-01T10:15:00.000Z",
    paidAt: null,
    reservationToken: mockToken,
    requestId: "req_test_123",
    createdAt: "2026-10-01T10:00:01.000Z",
    updatedAt: "2026-10-01T10:00:01.000Z",
  };

  const txn = (status: PaymentTransactionRecord["status"]): PaymentTransactionRecord => ({
    id: `txn-${status}`,
    paymentOrderId: localOrder.id,
    provider: "razorpay",
    gatewayPaymentId: `pay_${status}0001`,
    amountInPaise: 299900,
    feeInPaise: null,
    taxInPaise: null,
    status,
    paymentMethod: "upi",
    bankReference: null,
    errorCode: null,
    errorDescription: null,
    createdAt: "2026-10-01T10:01:00.000Z",
  });

  let mockSlotRepo: IConsultationSlotRepository;
  let mockConsultationRepo: IConsultationRepository;
  let mockPaymentOrderRepo: IPaymentOrderRepository;
  let mockTransactionRepo: IPaymentTransactionRepository;
  let mockLedger: IPaymentLedgerRepository;
  let mockGatewayAdapter: IOrderPaymentGateway;
  let service: ConsultationPaymentService;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockSlotRepo = {
      getSlotById: vi.fn().mockResolvedValue(mockSlot),
      createSlot: vi.fn(),
      getSlotsByTimeRange: vi.fn(),
      updateSlotStatus: vi.fn(),
      getAvailableSlots: vi.fn(),
      bulkCreateSlots: vi.fn(),
      reserveSlot: vi.fn(),
      releaseSlot: vi.fn(),
      confirmSlot: vi.fn(),
    };

    mockConsultationRepo = {
      getConsultationById: vi.fn().mockResolvedValue(mockConsultation),
      createConsultation: vi.fn(),
      updateConsultationStatus: vi.fn().mockResolvedValue({ ...mockConsultation, status: "awaiting_payment" }),
      detachStaleSlotHold: vi.fn(),
    };

    mockPaymentOrderRepo = {
      getLatestOrderByConsultationId: vi.fn().mockResolvedValue(null),
      createOrder: vi.fn().mockResolvedValue(localOrder),
      getOrderById: vi.fn().mockResolvedValue(localOrder),
      getOrderByGatewayId: vi.fn(),
      getOrderByProviderGatewayId: vi.fn(),
      getOrderByReceipt: vi.fn().mockResolvedValue(localOrder),
      attachGatewayOrderId: vi.fn().mockImplementation(async (id: string, gatewayOrderId: string) => ({
        ...localOrder,
        id,
        gatewayOrderId,
      })),
      updateOrderStatus: vi.fn(),
      listOpenOrders: vi.fn(),
    };

    mockTransactionRepo = {
      recordTransaction: vi.fn(),
      getTransactionById: vi.fn(),
      getTransactionByGatewayId: vi.fn(),
      getTransactionsByOrderId: vi.fn().mockResolvedValue([]),
    };

    mockLedger = {
      applyPaymentEvent: vi.fn(),
      createRefundIntent: vi.fn(),
      rebookConflictedConsultation: vi.fn(),
      claimNotification: vi.fn(),
      completeNotification: vi.fn(),
      listRetryableNotifications: vi.fn(),
      recordIssue: vi.fn().mockResolvedValue(undefined),
      resolveIssue: vi.fn(),
      listOpenIssues: vi.fn(),
      appendAudit: vi.fn(),
    };

    mockGatewayAdapter = {
      provider: "razorpay",
      createOrder: vi.fn().mockResolvedValue(remoteOrder),
      fetchOrder: vi.fn(),
      findOrderByReceipt: vi.fn().mockResolvedValue(null),
      fetchOrderPayments: vi.fn(),
      fetchPayment: vi.fn(),
      createRefund: vi.fn(),
      fetchRefund: vi.fn(),
      fetchPaymentRefunds: vi.fn(),
    };

    service = new ConsultationPaymentService({
      slotRepo: mockSlotRepo,
      consultationRepo: mockConsultationRepo,
      paymentOrderRepo: mockPaymentOrderRepo,
      transactionRepo: mockTransactionRepo,
      ledger: mockLedger,
      gateway: mockGatewayAdapter,
      keyIdResolver: () => "rzp_test_UnitTestKey000",
    });
  });

  describe("Constants and identifiers", () => {
    it("locks the reservation safety threshold to exactly 120 seconds", () => {
      expect(MIN_RESERVATION_SAFETY_LIFETIME_SECONDS).toBe(120);
    });

    it("builds a stable Razorpay receipt within the documented 40-character limit", () => {
      expect(receipt).toBe("rcpt_c7c88b90d4614fa3a75df152d113ba4c");
      expect(receipt.length).toBeLessThanOrEqual(40);
      expect(buildRazorpayReceipt(mockConsultationId)).toBe(receipt);
    });

    it("keeps the legacy Cashfree order id builder for historical records", () => {
      expect(buildDeterministicGatewayOrderId(mockConsultationId)).toBe("ord_c7c88b90d4614fa3a75df152d113ba4c");
    });
  });

  describe("Happy path", () => {
    it("persists the local order BEFORE calling Razorpay and returns only public checkout data", async () => {
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { requestId: "req_test_123", serverNow: baselineNow }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          keyId: "rzp_test_UnitTestKey000",
          gatewayOrderId: "order_TestOrder0001",
          amountInPaise: 299900,
          currency: "INR",
          // Server-authoritative: reservedUntil 10:15 - serverNow 10:00.
          reservationExpiresInSeconds: 900,
          reference: receipt,
          prefill: { name: "Ananya Roy", email: "ananya.roy@example.com", contact: "9876543210" },
        });
      }

      expect(mockPaymentOrderRepo.createOrder).toHaveBeenCalledWith({
        consultationId: mockConsultationId,
        provider: "razorpay",
        receipt,
        amountInPaise: 299900,
        currency: "INR",
        expiresAt: "2026-10-01T10:15:00.000Z",
        reservationToken: mockToken,
        requestId: "req_test_123",
      });
      expect(mockGatewayAdapter.createOrder).toHaveBeenCalledWith({
        receipt,
        amountInPaise: 299900,
        currency: "INR",
        notes: { payment_order_id: localOrder.id, consultation_id: mockConsultationId },
      });
      const localInsertOrder = vi.mocked(mockPaymentOrderRepo.createOrder).mock.invocationCallOrder[0];
      const gatewayCallOrder = vi.mocked(mockGatewayAdapter.createOrder).mock.invocationCallOrder[0];
      expect(localInsertOrder).toBeLessThan(gatewayCallOrder);
      expect(mockPaymentOrderRepo.attachGatewayOrderId).toHaveBeenCalledWith(localOrder.id, "order_TestOrder0001");
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(mockConsultationId, "awaiting_payment");
    });

    it("never takes the amount from anywhere but the server constant", async () => {
      await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );
      expect(vi.mocked(mockGatewayAdapter.createOrder).mock.calls[0][0].amountInPaise).toBe(299900);
    });
  });

  describe("Pre-Gateway Validation Failures", () => {
    it("fails when consultation does not exist", async () => {
      vi.mocked(mockConsultationRepo.getConsultationById).mockResolvedValueOnce(null);

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CONSULTATION_NOT_FOUND");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("fails when consultation is already confirmed", async () => {
      vi.mocked(mockConsultationRepo.getConsultationById).mockResolvedValueOnce({
        ...mockConsultation,
        status: "confirmed",
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CONSULTATION_ALREADY_CONFIRMED");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("fails when consultation is cancelled", async () => {
      vi.mocked(mockConsultationRepo.getConsultationById).mockResolvedValueOnce({
        ...mockConsultation,
        status: "cancelled_customer",
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CONSULTATION_CANCELLED");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("fails when consultation is in unexpected state (e.g. draft)", async () => {
      vi.mocked(mockConsultationRepo.getConsultationById).mockResolvedValueOnce({
        ...mockConsultation,
        status: "draft",
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("INVALID_CONSULTATION_STATUS");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("fails when consultation has no slotId", async () => {
      vi.mocked(mockConsultationRepo.getConsultationById).mockResolvedValueOnce({
        ...mockConsultation,
        slotId: null,
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CONSULTATION_HAS_NO_SLOT");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("fails when slot record does not exist in inventory", async () => {
      vi.mocked(mockSlotRepo.getSlotById).mockResolvedValueOnce(null);

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("SLOT_NOT_FOUND");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("fails when slot is not in reserved status (e.g. booked or available)", async () => {
      vi.mocked(mockSlotRepo.getSlotById).mockResolvedValueOnce({
        ...mockSlot,
        status: "available",
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("SLOT_NOT_RESERVED");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("fails when reservation token does not match (timing-safe check)", async () => {
      const differentToken = "b".repeat(64);

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: differentToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("INVALID_RESERVATION_TOKEN");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("Authoritative 120-Second Reservation Expiry Race Protection", () => {
    it("fails with RESERVATION_EXPIRED when reservation has already expired (0s remaining)", async () => {
      // Exactly at expiry instant: 10:15:00
      const atExpiryInstant = new Date("2026-10-01T10:15:00.000Z");

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: atExpiryInstant }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("RESERVATION_EXPIRED");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("fails with RESERVATION_EXPIRED when reservation is past expiry (< 0s remaining)", async () => {
      // 1 minute past expiry: 10:16:00
      const pastExpiryInstant = new Date("2026-10-01T10:16:00.000Z");

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: pastExpiryInstant }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("RESERVATION_EXPIRED");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("fails with RESERVATION_EXPIRING_SOON when remaining lifetime is less than 120 seconds (e.g. 119s)", async () => {
      // Expiry is 10:15:00. 119s before expiry: 10:13:01.000Z
      const sub120Instant = new Date("2026-10-01T10:13:01.000Z");

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: sub120Instant }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("RESERVATION_EXPIRING_SOON");
        expect(result.message).toContain("less than 2 minutes");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("passes when remaining lifetime is exactly 120 seconds", async () => {
      // Expiry is 10:15:00. Exactly 120s before expiry: 10:13:00.000Z
      const exactly120Instant = new Date("2026-10-01T10:13:00.000Z");

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: exactly120Instant }
      );

      expect(result.success).toBe(true);
      expect(mockGatewayAdapter.createOrder).toHaveBeenCalledTimes(1);
    });

    it("passes when remaining lifetime is well above 120 seconds (e.g. 900s)", async () => {
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(true);
      expect(mockGatewayAdapter.createOrder).toHaveBeenCalledTimes(1);
    });
  });

  describe("Post-gateway expiry race", () => {
    it("does not return checkout data or advance the consultation if the hold expires during the Razorpay call", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-01T10:12:50.000Z"));
      vi.mocked(mockGatewayAdapter.createOrder).mockImplementationOnce(async () => {
        vi.setSystemTime(new Date("2026-10-01T10:15:05.000Z"));
        return remoteOrder;
      });

      const result = await service.createPaymentOrder({ consultationId: mockConsultationId, reservationToken: mockToken });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("RESERVATION_EXPIRED");
        expect(result.message).toContain("expired during payment order preparation");
      }
      expect(mockConsultationRepo.updateConsultationStatus).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe("Idempotency, retries and recovery", () => {
    it("rejects with PAYMENT_ALREADY_COMPLETED when the order is already paid", async () => {
      vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({ ...localOrder, status: "paid" });
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("PAYMENT_ALREADY_COMPLETED");
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("retries a failed attempt on the SAME Razorpay order (no new order, no new consultation)", async () => {
      vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({
        ...localOrder,
        status: "attempted",
        gatewayOrderId: "order_TestOrder0001",
      });
      vi.mocked(mockTransactionRepo.getTransactionsByOrderId).mockResolvedValueOnce([txn("failed")]);

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.gatewayOrderId).toBe("order_TestOrder0001");
      expect(mockPaymentOrderRepo.createOrder).not.toHaveBeenCalled();
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
      expect(mockConsultationRepo.createConsultation).not.toHaveBeenCalled();
    });

    it.each(["pending", "success"] as const)(
      "refuses a new checkout while a %s payment exists (no blind second payment)",
      async (status) => {
        vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({
          ...localOrder,
          status: "attempted",
          gatewayOrderId: "order_TestOrder0001",
        });
        vi.mocked(mockTransactionRepo.getTransactionsByOrderId).mockResolvedValueOnce([txn(status)]);
        const result = await service.createPaymentOrder(
          { consultationId: mockConsultationId, reservationToken: mockToken },
          { serverNow: baselineNow }
        );
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toBe("PAYMENT_VERIFICATION_PENDING");
      }
    );

    it("never opens a Razorpay payment while a legacy Cashfree attempt is live", async () => {
      vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({
        ...localOrder,
        provider: "cashfree",
        receipt: null,
        gatewayOrderId: "ord_c7c88b90d4614fa3a75df152d113ba4c",
      });
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("PAYMENT_VERIFICATION_PENDING");
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
      expect(mockGatewayAdapter.findOrderByReceipt).not.toHaveBeenCalled();
    });

    it("keeps the local order (no link) when Razorpay times out, so the outcome stays recoverable", async () => {
      vi.mocked(mockGatewayAdapter.createOrder).mockRejectedValueOnce(
        new GatewayError("timeout", { code: "GATEWAY_TIMEOUT" })
      );
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("GATEWAY_TIMEOUT");
      expect(mockPaymentOrderRepo.createOrder).toHaveBeenCalledTimes(1);
      expect(mockPaymentOrderRepo.attachGatewayOrderId).not.toHaveBeenCalled();
      expect(mockConsultationRepo.updateConsultationStatus).not.toHaveBeenCalled();
    });

    it("recovers a lost Razorpay order by receipt on retry instead of creating a duplicate", async () => {
      vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({ ...localOrder });
      vi.mocked(mockGatewayAdapter.findOrderByReceipt).mockResolvedValueOnce(remoteOrder);

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(true);
      expect(mockGatewayAdapter.findOrderByReceipt).toHaveBeenCalledWith(receipt);
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
      expect(mockPaymentOrderRepo.createOrder).not.toHaveBeenCalled();
      expect(mockPaymentOrderRepo.attachGatewayOrderId).toHaveBeenCalledWith(localOrder.id, remoteOrder.id);
    });

    it("refuses and records an issue when Razorpay returns an order with a different amount", async () => {
      vi.mocked(mockGatewayAdapter.createOrder).mockResolvedValueOnce({ ...remoteOrder, amountInPaise: 100 });
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("GATEWAY_ERROR");
      expect(mockLedger.recordIssue).toHaveBeenCalledWith(expect.objectContaining({ kind: "amount_mismatch" }));
      expect(mockPaymentOrderRepo.attachGatewayOrderId).not.toHaveBeenCalled();
    });

    it("maps generic gateway rejections to GATEWAY_ERROR", async () => {
      vi.mocked(mockGatewayAdapter.createOrder).mockRejectedValueOnce(
        new GatewayError("rejected", { code: "GATEWAY_REJECTED", statusCode: 400 })
      );
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("GATEWAY_ERROR");
    });
  });

  describe("Database concurrency", () => {
    it("reuses the concurrent winner when the local insert hits the unique receipt (23505)", async () => {
      vi.mocked(mockPaymentOrderRepo.createOrder).mockRejectedValueOnce(
        Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" })
      );
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );
      expect(result.success).toBe(true);
      expect(mockPaymentOrderRepo.getOrderByReceipt).toHaveBeenCalledWith(receipt);
      expect(mockGatewayAdapter.createOrder).toHaveBeenCalledTimes(1);
    });

    it("returns DATABASE_ERROR for a non-conflict insert failure without calling Razorpay", async () => {
      vi.mocked(mockPaymentOrderRepo.createOrder).mockRejectedValueOnce(new Error("connection reset"));
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("DATABASE_ERROR");
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("returns DATABASE_ERROR if the consultation status update fails", async () => {
      vi.mocked(mockConsultationRepo.updateConsultationStatus).mockRejectedValueOnce(new Error("db down"));
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("DATABASE_ERROR");
    });
  });
});
