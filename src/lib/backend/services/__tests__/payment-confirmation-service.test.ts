import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PaymentConfirmationService,
} from "../payment-confirmation-service";
import { IPaymentOrderRepository } from "../../repositories/payment-order-repository.interface";
import { IPaymentTransactionRepository } from "../../repositories/payment-transaction-repository.interface";
import { IConsultationRepository } from "../../repositories/consultation-repository.interface";
import { IConsultationSlotRepository } from "../../repositories/consultation-slot-repository.interface";
import {
  ConsultationRecord,
  ConsultationSlotRecord,
  PaymentOrderRecord,
  PaymentTransactionRecord,
} from "../../types/payment-and-consultation";
import { NormalizedCashfreePaymentWebhook } from "../../domain/webhook-types";

describe("PaymentConfirmationService Suite (Step 6B.1)", () => {
  const mockOrderId = "ord_c7c88b90d4614fa3a75df152d113ba4c";
  const mockLocalOrderId = "order-local-uuid-1";
  const mockConsultationId = "c7c88b90-d461-4fa3-a75d-f152d113ba4c";
  const mockSlotId = "slot-uuid-999";
  const mockReservationToken = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const mockGatewayPaymentId = "cf_pay_12345678";

  const mockPaymentOrder: PaymentOrderRecord = {
    id: mockLocalOrderId,
    consultationId: mockConsultationId,
    gatewayOrderId: mockOrderId,
    amountInPaise: 299900,
    currency: "INR",
    status: "created",
    expiresAt: "2026-10-01T10:15:00.000Z",
    paidAt: null,
    reservationToken: mockReservationToken,
    requestId: "req_test_123",
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
    eventType: "Diwali Special",
    eventTypeOther: null,
    guestCount: "20",
    eventDateApprox: "November 2026",
    meetingChannel: "video",
    status: "awaiting_payment",
    cancellationReason: null,
    rescheduledFromId: null,
    rescheduleCount: 0,
    requestId: "req_test_123",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  };

  const mockSlot: ConsultationSlotRecord = {
    id: mockSlotId,
    startTime: "2026-10-02T10:00:00.000Z",
    endTime: "2026-10-02T11:00:00.000Z",
    status: "reserved",
    reservedUntil: "2026-10-01T10:15:00.000Z",
    reservationToken: mockReservationToken,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  };

  const mockSuccessWebhook: NormalizedCashfreePaymentWebhook = {
    eventType: "PAYMENT_SUCCESS_WEBHOOK",
    orderId: mockOrderId,
    gatewayPaymentId: mockGatewayPaymentId,
    paymentStatus: "SUCCESS",
    amountInPaise: 299900,
    currency: "INR",
    paymentMethod: "upi",
    bankReference: "UTR1234567890",
    errorCode: null,
    errorDescription: null,
    eventTime: "2026-10-01T10:05:00.000Z",
    rawPayload: { event: "PAYMENT_SUCCESS_WEBHOOK" },
  };

  const mockTransactionRecord: PaymentTransactionRecord = {
    id: "tx-uuid-001",
    paymentOrderId: mockLocalOrderId,
    gatewayPaymentId: mockGatewayPaymentId,
    amountInPaise: 299900,
    feeInPaise: null,
    taxInPaise: null,
    status: "success",
    paymentMethod: "upi",
    bankReference: "UTR1234567890",
    errorCode: null,
    errorDescription: null,
    createdAt: "2026-10-01T10:05:01.000Z",
  };

  let mockPaymentOrderRepo: IPaymentOrderRepository;
  let mockPaymentTransactionRepo: IPaymentTransactionRepository;
  let mockConsultationRepo: IConsultationRepository;
  let mockSlotRepo: IConsultationSlotRepository;
  let service: PaymentConfirmationService;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockPaymentOrderRepo = {
      getOrderById: vi.fn().mockResolvedValue(mockPaymentOrder),
      getOrderByGatewayId: vi.fn().mockResolvedValue(mockPaymentOrder),
      createOrder: vi.fn(),
      updateOrderStatus: vi.fn().mockImplementation(async (_id, status, details) => {
        const order = (await mockPaymentOrderRepo.getOrderByGatewayId(mockOrderId)) || mockPaymentOrder;
        return {
          ...order,
          status,
          paidAt: details?.paidAt || "2026-10-01T10:05:00.000Z",
        };
      }),
      getLatestOrderByConsultationId: vi.fn(),
    };

    mockPaymentTransactionRepo = {
      recordTransaction: vi.fn().mockResolvedValue(mockTransactionRecord),
      getTransactionById: vi.fn(),
      getTransactionByGatewayId: vi.fn().mockResolvedValue(null),
      getTransactionsByOrderId: vi.fn().mockResolvedValue([]),
    };

    mockConsultationRepo = {
      getConsultationById: vi.fn().mockResolvedValue(mockConsultation),
      createConsultation: vi.fn(),
      updateConsultationStatus: vi.fn().mockResolvedValue({
        ...mockConsultation,
        status: "confirmed",
      }),
      detachStaleSlotHold: vi.fn(),
    };

    mockSlotRepo = {
      getSlotById: vi.fn().mockResolvedValue(mockSlot),
      createSlot: vi.fn(),
      getSlotsByTimeRange: vi.fn(),
      updateSlotStatus: vi.fn(),
      getAvailableSlots: vi.fn(),
      bulkCreateSlots: vi.fn(),
      reserveSlot: vi.fn(),
      releaseSlot: vi.fn(),
      confirmSlot: vi.fn().mockResolvedValue({
        ...mockSlot,
        status: "booked",
        reservationToken: null,
        reservedUntil: null,
      }),
    };

    service = new PaymentConfirmationService(
      mockPaymentOrderRepo,
      mockPaymentTransactionRepo,
      mockConsultationRepo,
      mockSlotRepo
    );
  });

  // ============================================================================
  // A. SUCCESS PATH
  // ============================================================================
  describe("A. Success Path", () => {
    it("1. records payment transaction on success", async () => {
      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      expect(mockPaymentTransactionRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentOrderId: mockLocalOrderId,
          gatewayPaymentId: mockGatewayPaymentId,
          amountInPaise: 299900,
          status: "success",
          paymentMethod: "upi",
          bankReference: "UTR1234567890",
        })
      );
    });

    it("2. marks payment order as paid with timestamp", async () => {
      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      expect(mockPaymentOrderRepo.updateOrderStatus).toHaveBeenCalledWith(
        mockLocalOrderId,
        "paid",
        expect.objectContaining({
          paidAt: "2026-10-01T10:05:00.000Z",
        })
      );
    });

    it("3. books slot via confirmSlot RPC wrapper", async () => {
      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      expect(mockSlotRepo.confirmSlot).toHaveBeenCalledWith(
        mockSlotId,
        mockReservationToken
      );
    });

    it("4. transitions consultation to confirmed", async () => {
      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("confirmed");
        expect(result.orderId).toBe(mockLocalOrderId);
        expect(result.consultationId).toBe(mockConsultationId);
      }
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "confirmed"
      );
    });
  });

  // ============================================================================
  // B. VALIDATION
  // ============================================================================
  describe("B. Validation & Security Guards", () => {
    it("5. rejects unknown order without modifying database state", async () => {
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("ORDER_NOT_FOUND");
      }
      expect(mockPaymentTransactionRepo.recordTransaction).not.toHaveBeenCalled();
      expect(mockPaymentOrderRepo.updateOrderStatus).not.toHaveBeenCalled();
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
    });

    it("6. rejects amount mismatch and does not mark order paid or confirm slot", async () => {
      const tamperedWebhook: NormalizedCashfreePaymentWebhook = {
        ...mockSuccessWebhook,
        amountInPaise: 100000, // ₹1,000 instead of ₹2,999
      };

      const result = await service.processPaymentWebhook(tamperedWebhook);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("AMOUNT_MISMATCH");
      }
      expect(mockPaymentTransactionRepo.recordTransaction).not.toHaveBeenCalled();
      expect(mockPaymentOrderRepo.updateOrderStatus).not.toHaveBeenCalled();
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
    });

    it("7. rejects currency mismatch safely", async () => {
      const tamperedWebhook: NormalizedCashfreePaymentWebhook = {
        ...mockSuccessWebhook,
        currency: "USD",
      };

      const result = await service.processPaymentWebhook(tamperedWebhook);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CURRENCY_MISMATCH");
      }
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
    });

    it("8. rejects when consultation record is missing", async () => {
      (mockConsultationRepo.getConsultationById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CONSULTATION_NOT_FOUND");
      }
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
    });

    it("9. rejects when consultation has no slotId", async () => {
      (mockConsultationRepo.getConsultationById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockConsultation,
        slotId: null,
      });

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CONSULTATION_HAS_NO_SLOT");
      }
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
    });

    it("10. rejects when payment order is missing reservationToken", async () => {
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        reservationToken: null,
      });

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("MISSING_RESERVATION_TOKEN");
      }
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // C. SLOT / SECURITY & RESERVATION TOKEN PROVENANCE
  // ============================================================================
  describe("C. Slot & Security Guarantees", () => {
    it("11. passes EXACTLY paymentOrder.reservationToken to confirmSlot", async () => {
      const customToken = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        reservationToken: customToken,
      });

      await service.processPaymentWebhook(mockSuccessWebhook);

      expect(mockSlotRepo.confirmSlot).toHaveBeenCalledWith(mockSlotId, customToken);
    });

    it("12. does NOT trust slot's current token as substitute for paymentOrder.reservationToken", async () => {
      // Suppose slot currently has a different token in DB
      (mockSlotRepo.getSlotById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSlot,
        reservationToken: "different_current_slot_token_99999999999999999999999999999999",
      });

      await service.processPaymentWebhook(mockSuccessWebhook);

      // Must strictly use mockPaymentOrder.reservationToken, NOT the slot's token
      expect(mockSlotRepo.confirmSlot).toHaveBeenCalledWith(mockSlotId, mockReservationToken);
    });

    it("13. succeeds on valid late webhook after hold expired when slot was uncontested", async () => {
      // Slot hold expired (e.g. reservedUntil in past), but confirmSlot succeeds due to relaxed DB-001 RPC
      (mockSlotRepo.confirmSlot as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSlot,
        status: "booked",
        reservationToken: null,
        reservedUntil: null,
      });

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("confirmed");
      }
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "confirmed"
      );
    });

    it("14. routes to slot conflict when token mismatch occurs in confirmSlot", async () => {
      // confirmSlot returns null due to token mismatch (e.g. RPC matched 0 rows)
      (mockSlotRepo.confirmSlot as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("slot_conflict");
      }
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "slot_conflict_pending_reschedule"
      );
      // Order must still be marked paid because payment succeeded
      expect(mockPaymentOrderRepo.updateOrderStatus).toHaveBeenCalledWith(
        mockLocalOrderId,
        "paid",
        expect.any(Object)
      );
    });

    it("15. Customer A / Customer B race: preserves Customer B's reservation and routes Customer A to conflict", async () => {
      // Customer B reserved slot with their own token, so confirmSlot with Customer A's token fails
      (mockSlotRepo.confirmSlot as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      // Slot is currently reserved by Customer B
      (mockSlotRepo.getSlotById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSlot,
        reservationToken: "customer_b_token_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        status: "reserved",
      });

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("slot_conflict");
      }
      // Customer B's slot is NOT altered or released
      expect(mockSlotRepo.updateSlotStatus).not.toHaveBeenCalled();
      expect(mockSlotRepo.releaseSlot).not.toHaveBeenCalled();
      // Customer A is routed to slot_conflict_pending_reschedule
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "slot_conflict_pending_reschedule"
      );
    });
  });

  // ============================================================================
  // D. IDEMPOTENCY
  // ============================================================================
  describe("D. Idempotency & Replay Handling", () => {
    it("16. reuses existing transaction when gatewayPaymentId already exists", async () => {
      (mockPaymentTransactionRepo.getTransactionByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTransactionRecord
      );

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      expect(mockPaymentTransactionRepo.recordTransaction).not.toHaveBeenCalled();
    });

    it("17. returns duplicate outcome when order is already paid and consultation is already confirmed", async () => {
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        status: "paid",
        paidAt: "2026-10-01T10:05:00.000Z",
      });
      (mockConsultationRepo.getConsultationById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockConsultation,
        status: "confirmed",
      });

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("duplicate");
      }
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
      expect(mockConsultationRepo.updateConsultationStatus).not.toHaveBeenCalled();
    });

    it("18. returns slot_conflict when consultation is already in slot_conflict_pending_reschedule", async () => {
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        status: "paid",
        paidAt: "2026-10-01T10:05:00.000Z",
      });
      (mockConsultationRepo.getConsultationById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockConsultation,
        status: "slot_conflict_pending_reschedule",
      });

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("slot_conflict");
      }
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
    });

    it("19. recovers when order is already paid but consultation not yet finalized", async () => {
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        status: "paid",
        paidAt: "2026-10-01T10:05:00.000Z",
      });
      (mockConsultationRepo.getConsultationById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockConsultation,
        status: "awaiting_payment",
      });

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("confirmed");
      }
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "confirmed"
      );
    });

    it("20. recovers on retry when slot was already booked in prior partial attempt", async () => {
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        status: "paid",
        paidAt: "2026-10-01T10:05:00.000Z",
      });
      (mockConsultationRepo.getConsultationById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockConsultation,
        status: "awaiting_payment",
      });
      // confirmSlot returns null because slot is already 'booked'
      (mockSlotRepo.confirmSlot as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      // getSlotById shows slot is indeed booked
      (mockSlotRepo.getSlotById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSlot,
        status: "booked",
        reservationToken: null,
      });

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("confirmed");
      }
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "confirmed"
      );
    });
  });

  // ============================================================================
  // E. FAILURES & USER DROPPED
  // ============================================================================
  describe("E. Payment Failures & Dropped Flow", () => {
    it("21. records failed transaction and transitions order to failed", async () => {
      const failedWebhook: NormalizedCashfreePaymentWebhook = {
        ...mockSuccessWebhook,
        eventType: "PAYMENT_FAILED_WEBHOOK",
        paymentStatus: "FAILED",
        errorCode: "INSUFFICIENT_FUNDS",
        errorDescription: "Customer bank reported insufficient funds.",
      };

      const result = await service.processPaymentWebhook(failedWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("payment_failed");
      }
      expect(mockPaymentTransactionRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          errorCode: "INSUFFICIENT_FUNDS",
          errorDescription: "Customer bank reported insufficient funds.",
        })
      );
      expect(mockPaymentOrderRepo.updateOrderStatus).toHaveBeenCalledWith(
        mockLocalOrderId,
        "failed"
      );
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
      expect(mockConsultationRepo.updateConsultationStatus).not.toHaveBeenCalled();
    });

    it("22. records user_dropped transaction and transitions order to attempted", async () => {
      const droppedWebhook: NormalizedCashfreePaymentWebhook = {
        ...mockSuccessWebhook,
        eventType: "PAYMENT_USER_DROPPED_WEBHOOK",
        paymentStatus: "USER_DROPPED",
      };

      const result = await service.processPaymentWebhook(droppedWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("user_dropped");
      }
      expect(mockPaymentTransactionRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "user_dropped",
        })
      );
      expect(mockPaymentOrderRepo.updateOrderStatus).toHaveBeenCalledWith(
        mockLocalOrderId,
        "attempted"
      );
      expect(mockSlotRepo.confirmSlot).not.toHaveBeenCalled();
      expect(mockConsultationRepo.updateConsultationStatus).not.toHaveBeenCalled();
    });

    it("23. does not revert already paid order on subsequent failed webhook", async () => {
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        status: "paid",
        paidAt: "2026-10-01T10:05:00.000Z",
      });

      const failedWebhook: NormalizedCashfreePaymentWebhook = {
        ...mockSuccessWebhook,
        eventType: "PAYMENT_FAILED_WEBHOOK",
        paymentStatus: "FAILED",
      };

      const result = await service.processPaymentWebhook(failedWebhook);

      expect(result.success).toBe(true);
      expect(mockPaymentOrderRepo.updateOrderStatus).not.toHaveBeenCalledWith(
        mockLocalOrderId,
        "failed"
      );
    });

    it("24. does not revert already paid order on subsequent dropped webhook", async () => {
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        status: "paid",
        paidAt: "2026-10-01T10:05:00.000Z",
      });

      const droppedWebhook: NormalizedCashfreePaymentWebhook = {
        ...mockSuccessWebhook,
        eventType: "PAYMENT_USER_DROPPED_WEBHOOK",
        paymentStatus: "USER_DROPPED",
      };

      const result = await service.processPaymentWebhook(droppedWebhook);

      expect(result.success).toBe(true);
      expect(mockPaymentOrderRepo.updateOrderStatus).not.toHaveBeenCalledWith(
        mockLocalOrderId,
        "attempted"
      );
    });
  });

  // ============================================================================
  // F. PARTIAL FAILURE RECOVERY
  // ============================================================================
  describe("F. Partial Failure Recovery", () => {
    it("25. recovers when transaction was already recorded but order was not yet paid", async () => {
      (mockPaymentTransactionRepo.getTransactionByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockTransactionRecord
      );
      // order status is still 'created'
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        status: "created",
      });

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("confirmed");
      }
      expect(mockPaymentOrderRepo.updateOrderStatus).toHaveBeenCalledWith(
        mockLocalOrderId,
        "paid",
        expect.any(Object)
      );
      expect(mockSlotRepo.confirmSlot).toHaveBeenCalledWith(mockSlotId, mockReservationToken);
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "confirmed"
      );
    });

    it("26. handles unique constraint 23505 collision when recording transaction concurrently", async () => {
      const conflictError = new Error("duplicate key value violates unique constraint idx_trans_gateway_payment_id");
      (conflictError as unknown as { code: string }).code = "23505";

      (mockPaymentTransactionRepo.recordTransaction as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(conflictError);
      (mockPaymentTransactionRepo.getTransactionByGatewayId as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null) // first check
        .mockResolvedValueOnce(mockTransactionRecord); // second check after conflict

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("confirmed");
      }
    });

    it("27. safely aborts when confirmSlot RPC throws unexpected database error", async () => {
      (mockSlotRepo.confirmSlot as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Connection reset by peer")
      );

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("DATABASE_ERROR");
      }
      expect(mockConsultationRepo.updateConsultationStatus).not.toHaveBeenCalled();
    });

    it("28. handles conflict when updating consultation to confirmed fails due to unique confirmed slot constraint", async () => {
      (mockPaymentOrderRepo.getOrderByGatewayId as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockPaymentOrder,
        status: "paid",
      });
      (mockSlotRepo.confirmSlot as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (mockSlotRepo.getSlotById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockSlot,
        status: "booked",
      });

      // Another consultation already claimed confirmed status on this slot!
      const uniqueConstraintError = new Error("duplicate key value violates unique constraint idx_consultations_confirmed_slot");
      (uniqueConstraintError as unknown as { code: string }).code = "23505";

      (mockConsultationRepo.updateConsultationStatus as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(uniqueConstraintError) // attempt to confirm fails
        .mockResolvedValueOnce({
          ...mockConsultation,
          status: "slot_conflict_pending_reschedule",
        }); // fallback to conflict succeeds

      const result = await service.processPaymentWebhook(mockSuccessWebhook);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.outcome).toBe("slot_conflict");
      }
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "slot_conflict_pending_reschedule"
      );
    });
  });

  // ============================================================================
  // G. METADATA & DATA FIDELITY
  // ============================================================================
  describe("G. Metadata & Data Fidelity", () => {
    it("29. correctly persists gatewayPaymentId from webhook", async () => {
      await service.processPaymentWebhook(mockSuccessWebhook);

      expect(mockPaymentTransactionRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          gatewayPaymentId: mockGatewayPaymentId,
        })
      );
    });

    it("30. correctly persists integer paise amount in transaction", async () => {
      await service.processPaymentWebhook(mockSuccessWebhook);

      expect(mockPaymentTransactionRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amountInPaise: 299900,
        })
      );
    });

    it("31. normalizes card, netbanking, and wallet payment methods correctly", async () => {
      const cardWebhook: NormalizedCashfreePaymentWebhook = {
        ...mockSuccessWebhook,
        gatewayPaymentId: "cf_pay_card_123",
        paymentMethod: "credit_card",
      };

      await service.processPaymentWebhook(cardWebhook);

      expect(mockPaymentTransactionRepo.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: "card",
        })
      );
    });
  });
});
