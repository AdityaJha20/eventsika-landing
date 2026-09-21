import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConsultationPaymentService,
  buildDeterministicGatewayOrderId,
  MIN_RESERVATION_SAFETY_LIFETIME_SECONDS,
} from "../consultation-payment-service";
import { IConsultationSlotRepository } from "../../repositories/consultation-slot-repository.interface";
import { IConsultationRepository } from "../../repositories/consultation-repository.interface";
import { IPaymentOrderRepository } from "../../repositories/payment-order-repository.interface";
import {
  GatewayError,
  GatewayOrderResult,
  IPaymentGatewayAdapter,
} from "../../integrations/payment-gateway.interface";
import {
  ConsultationRecord,
  ConsultationSlotRecord,
  PaymentOrderRecord,
} from "../../types/payment-and-consultation";

describe("ConsultationPaymentService Suite (Step 4)", () => {
  const mockConsultationId = "c7c88b90-d461-4fa3-a75d-f152d113ba4c";
  const mockSlotId = "slot-uuid-999";
  const mockToken = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"; // 64 hex
  const deterministicOrderId = buildDeterministicGatewayOrderId(mockConsultationId);

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
    eventType: "Diwali Special",
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

  const mockGatewayOrderResult: GatewayOrderResult = {
    gatewayOrderId: "cf_10293847",
    merchantOrderId: deterministicOrderId,
    paymentSessionId: "session_mock_valid_12345",
    orderStatus: "ACTIVE",
    orderAmount: 2999.0,
    orderCurrency: "INR",
    orderExpiryTime: "2026-10-01T10:15:00.000Z",
  };

  const mockSavedPaymentOrder: PaymentOrderRecord = {
    id: "order-local-uuid-1",
    consultationId: mockConsultationId,
    gatewayOrderId: deterministicOrderId,
    amountInPaise: 299900,
    currency: "INR",
    status: "created",
    expiresAt: "2026-10-01T10:15:00.000Z",
    paidAt: null,
    requestId: "req_test_123",
    createdAt: "2026-10-01T10:00:01.000Z",
    updatedAt: "2026-10-01T10:00:01.000Z",
  };

  let mockSlotRepo: IConsultationSlotRepository;
  let mockConsultationRepo: IConsultationRepository;
  let mockPaymentOrderRepo: IPaymentOrderRepository;
  let mockGatewayAdapter: IPaymentGatewayAdapter;
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
      updateConsultationStatus: vi.fn().mockResolvedValue({
        ...mockConsultation,
        status: "awaiting_payment",
      }),
      detachStaleSlotHold: vi.fn(),
    };

    mockPaymentOrderRepo = {
      getLatestOrderByConsultationId: vi.fn().mockResolvedValue(null),
      createOrder: vi.fn().mockResolvedValue(mockSavedPaymentOrder),
      getOrderById: vi.fn().mockResolvedValue(mockSavedPaymentOrder),
      getOrderByGatewayId: vi.fn().mockResolvedValue(mockSavedPaymentOrder),
      updateOrderStatus: vi.fn(),
    };

    mockGatewayAdapter = {
      createOrder: vi.fn().mockResolvedValue(mockGatewayOrderResult),
      getOrder: vi.fn().mockResolvedValue(mockGatewayOrderResult),
      getEnvironment: vi.fn().mockReturnValue("sandbox"),
    };

    service = new ConsultationPaymentService(
      mockSlotRepo,
      mockConsultationRepo,
      mockPaymentOrderRepo,
      mockGatewayAdapter
    );
  });

  describe("Deterministic Order ID Construction", () => {
    it("locks the reservation safety threshold to exactly 120 seconds", () => {
      expect(MIN_RESERVATION_SAFETY_LIFETIME_SECONDS).toBe(120);
    });

    it("constructs correct 36-character order ID without hyphens", () => {
      const orderId = buildDeterministicGatewayOrderId(mockConsultationId);
      expect(orderId).toBe("ord_c7c88b90d4614fa3a75df152d113ba4c");
      expect(orderId.length).toBe(36);
      expect(orderId.startsWith("ord_")).toBe(true);
      expect(/^[a-zA-Z0-9_-]{3,45}$/.test(orderId)).toBe(true);
    });
  });

  describe("Happy Path Order Creation Pipeline", () => {
    it("successfully validates, calls Cashfree, persists payment order, updates consultation, and returns paymentSessionId", async () => {
      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { requestId: "req_test_123", serverNow: baselineNow }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentSessionId).toBe("session_mock_valid_12345");
        expect(result.data.orderId).toBe(deterministicOrderId);
        expect(result.data.amountInPaise).toBe(299900);
        expect(result.data.currency).toBe("INR");
        expect(result.data.environment).toBe("sandbox");
      }

      // 1. Loaded consultation & slot
      expect(mockConsultationRepo.getConsultationById).toHaveBeenCalledWith(mockConsultationId);
      expect(mockSlotRepo.getSlotById).toHaveBeenCalledWith(mockSlotId);

      // 2. Gateway-First: called Cashfree with deterministic ID and authoritative price
      expect(mockGatewayAdapter.createOrder).toHaveBeenCalledWith({
        orderId: deterministicOrderId,
        amountInPaise: 299900,
        currency: "INR",
        customer: {
          id: "cust_c7c88b90d4614fa3",
          name: "Ananya Roy",
          email: "ananya.roy@example.com",
          phone: "9876543210",
        },
        orderExpiryTime: "2026-10-01T10:15:00.000Z",
        orderNote: "Eventsika Consultation Booking",
      });

      // 3. Persisted local payment_orders row
      expect(mockPaymentOrderRepo.createOrder).toHaveBeenCalledWith({
        consultationId: mockConsultationId,
        gatewayOrderId: deterministicOrderId,
        amountInPaise: 299900,
        currency: "INR",
        expiresAt: "2026-10-01T10:15:00.000Z",
        requestId: "req_test_123",
      });

      // 4. Transitioned consultation to 'awaiting_payment'
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "awaiting_payment"
      );
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

  describe("Post-Gateway Expiry Race Protection", () => {
    it("aborts persistence and returns RESERVATION_EXPIRED if hold expires during gateway request roundtrip", async () => {
      vi.useFakeTimers();
      // Setup: Pre-check passes with 130 seconds left (10:12:50.000Z)
      const preCheckTime = new Date("2026-10-01T10:12:50.000Z");
      vi.setSystemTime(preCheckTime);

      // When createOrder is called, time advances such that post-check is past expiry (10:15:05.000Z)
      vi.mocked(mockGatewayAdapter.createOrder).mockImplementationOnce(async () => {
        vi.setSystemTime(new Date("2026-10-01T10:15:05.000Z"));
        return mockGatewayOrderResult;
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("RESERVATION_EXPIRED");
        expect(result.message).toContain("expired during payment order preparation");
      }

      // Gateway was called, BUT local DB insert and consultation transition were blocked!
      expect(mockGatewayAdapter.createOrder).toHaveBeenCalled();
      expect(mockPaymentOrderRepo.createOrder).not.toHaveBeenCalled();
      expect(mockConsultationRepo.updateConsultationStatus).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("Existing Payment Order Idempotency & Recovery", () => {
    it("rejects with PAYMENT_ALREADY_COMPLETED when local payment order is already paid", async () => {
      vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({
        ...mockSavedPaymentOrder,
        status: "paid",
        paidAt: "2026-10-01T10:05:00.000Z",
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("PAYMENT_ALREADY_COMPLETED");
      }
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
    });

    it("recovers active Cashfree order and session when local order is created or attempted", async () => {
      vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({
        ...mockSavedPaymentOrder,
        status: "created",
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentSessionId).toBe("session_mock_valid_12345");
      }

      // Recovered via getOrder, NOT a new createOrder call
      expect(mockGatewayAdapter.getOrder).toHaveBeenCalledWith(deterministicOrderId);
      expect(mockGatewayAdapter.createOrder).not.toHaveBeenCalled();
      expect(mockPaymentOrderRepo.createOrder).not.toHaveBeenCalled();
    });

    it("synchronizes local status and returns PAYMENT_ALREADY_COMPLETED if recovered order was paid at provider", async () => {
      vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({
        ...mockSavedPaymentOrder,
        status: "created",
      });

      vi.mocked(mockGatewayAdapter.getOrder).mockResolvedValueOnce({
        ...mockGatewayOrderResult,
        orderStatus: "PAID",
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("PAYMENT_ALREADY_COMPLETED");
      }
      expect(mockPaymentOrderRepo.updateOrderStatus).toHaveBeenCalledWith(
        mockSavedPaymentOrder.id,
        "paid",
        expect.objectContaining({ paidAt: expect.any(String) })
      );
    });

    it("rejects with PAYMENT_ORDER_EXPIRED if recovered provider order is EXPIRED or TERMINATED", async () => {
      vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({
        ...mockSavedPaymentOrder,
        status: "created",
      });

      vi.mocked(mockGatewayAdapter.getOrder).mockResolvedValueOnce({
        ...mockGatewayOrderResult,
        orderStatus: "EXPIRED",
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("PAYMENT_ORDER_EXPIRED");
      }
    });

    it("self-heals consultation status to awaiting_payment during recovery if it remained slot_held", async () => {
      vi.mocked(mockPaymentOrderRepo.getLatestOrderByConsultationId).mockResolvedValueOnce({
        ...mockSavedPaymentOrder,
        status: "created",
      });

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(true);
      expect(mockConsultationRepo.updateConsultationStatus).toHaveBeenCalledWith(
        mockConsultationId,
        "awaiting_payment"
      );
    });
  });

  describe("Cashfree Gateway Failure Handling", () => {
    it("maps GATEWAY_TIMEOUT to 504 status", async () => {
      vi.mocked(mockGatewayAdapter.createOrder).mockRejectedValueOnce(
        new GatewayError("Timeout", { code: "GATEWAY_TIMEOUT" })
      );

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("GATEWAY_TIMEOUT");
        expect(result.message).toContain("timed out");
      }
      expect(mockPaymentOrderRepo.createOrder).not.toHaveBeenCalled();
    });

    it("maps generic GatewayError to GATEWAY_ERROR", async () => {
      vi.mocked(mockGatewayAdapter.createOrder).mockRejectedValueOnce(
        new GatewayError("Network failure", { code: "NETWORK_ERROR" })
      );

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("GATEWAY_ERROR");
      }
      expect(mockPaymentOrderRepo.createOrder).not.toHaveBeenCalled();
    });
  });

  describe("Database Concurrency & Unique Conflict (PostgreSQL 23505)", () => {
    it("recovers winning record when duplicate insert error occurs (23505 unique conflict)", async () => {
      const conflictError = new Error(
        'duplicate key value violates unique constraint "idx_orders_gateway_order_id"'
      );
      (conflictError as unknown as { code: string }).code = "23505";

      vi.mocked(mockPaymentOrderRepo.createOrder).mockRejectedValueOnce(conflictError);
      vi.mocked(mockPaymentOrderRepo.getOrderByGatewayId).mockResolvedValueOnce(mockSavedPaymentOrder);

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentSessionId).toBe("session_mock_valid_12345");
      }
      expect(mockPaymentOrderRepo.getOrderByGatewayId).toHaveBeenCalledWith(deterministicOrderId);
    });

    it("returns DATABASE_ERROR if consultation status update fails after order insert", async () => {
      vi.mocked(mockConsultationRepo.updateConsultationStatus).mockRejectedValueOnce(
        new Error("Connection reset")
      );

      const result = await service.createPaymentOrder(
        { consultationId: mockConsultationId, reservationToken: mockToken },
        { serverNow: baselineNow }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("DATABASE_ERROR");
      }
    });
  });
});
