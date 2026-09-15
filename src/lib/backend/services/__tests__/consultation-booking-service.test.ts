import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsultationBookingService } from "../consultation-booking-service";
import { IConsultationSlotRepository } from "../../repositories/consultation-slot-repository.interface";
import { IConsultationRepository } from "../../repositories/consultation-repository.interface";
import { ValidatedConsultationInput } from "../../validation/consultation-schema";
import { ConsultationSlotRecord, ConsultationRecord } from "../../types/payment-and-consultation";

describe("ConsultationBookingService", () => {
  let mockSlotRepo: IConsultationSlotRepository;
  let mockConsultationRepo: IConsultationRepository;
  let bookingService: ConsultationBookingService;

  const sampleFutureSlot: ConsultationSlotRecord = {
    id: "slot-uuid-1",
    startTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h in future
    endTime: new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString(),
    status: "available",
    reservationToken: null,
    reservedUntil: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleLeadTimeViolatingSlot: ConsultationSlotRecord = {
    id: "slot-uuid-2",
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // only 2h in future (<24h)
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    status: "available",
    reservationToken: null,
    reservedUntil: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleIntakeInput: ValidatedConsultationInput = {
    customerFirstName: "Pooja",
    customerLastName: "Sharma",
    customerPhone: "9876543210",
    customerEmail: "pooja.sharma@example.com",
    customerCity: "Bengaluru",
    eventType: "Anniversary",
    eventTypeOther: null,
    guestCount: "50-100",
    eventDateApprox: "2026-11-15",
    meetingChannel: "video",
    slotId: "slot-uuid-1",
  };

  const sampleConsultation: ConsultationRecord = {
    id: "consultation-uuid-999",
    slotId: "slot-uuid-1",
    customerFirstName: "Pooja",
    customerLastName: "Sharma",
    customerPhone: "9876543210",
    customerEmail: "pooja.sharma@example.com",
    customerCity: "Bengaluru",
    eventType: "Anniversary",
    eventTypeOther: null,
    guestCount: "50-100",
    eventDateApprox: "2026-11-15",
    meetingChannel: "video",
    status: "slot_held",
    cancellationReason: null,
    rescheduledFromId: null,
    rescheduleCount: 0,
    requestId: "req-123",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockSlotRepo = {
      getSlotById: vi.fn().mockResolvedValue(sampleFutureSlot),
      getAvailableSlots: vi.fn().mockResolvedValue([sampleFutureSlot]),
      getSlotsByTimeRange: vi.fn().mockResolvedValue([sampleFutureSlot]),
      bulkCreateSlots: vi.fn().mockResolvedValue(undefined),
      reserveSlot: vi.fn().mockResolvedValue({
        ...sampleFutureSlot,
        status: "reserved",
        reservationToken: "mock-token-256",
        reservedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }),
      releaseSlot: vi.fn().mockResolvedValue(true),
      confirmSlot: vi.fn().mockResolvedValue(true),
      createSlot: vi.fn(),
      updateSlotStatus: vi.fn(),
    };

    mockConsultationRepo = {
      createConsultation: vi.fn().mockResolvedValue(sampleConsultation),
      getConsultationById: vi.fn().mockResolvedValue(sampleConsultation),
      updateConsultationStatus: vi.fn().mockResolvedValue(sampleConsultation),
      detachStaleSlotHold: vi.fn().mockResolvedValue(0),
    };

    bookingService = new ConsultationBookingService(mockSlotRepo, mockConsultationRepo);
  });

  describe("Availability & JIT Slot Materialization", () => {
    it("materializes missing slots via bulkCreateSlots and returns available slots DTO", async () => {
      const slots = await bookingService.getAvailableSlots();

      expect(mockSlotRepo.bulkCreateSlots).toHaveBeenCalledTimes(1);
      const bulkGenerated = vi.mocked(mockSlotRepo.bulkCreateSlots).mock.calls[0][0];
      expect(bulkGenerated.length).toBeGreaterThan(0);

      expect(mockSlotRepo.getAvailableSlots).toHaveBeenCalledTimes(1);
      expect(slots).toEqual([
        {
          id: sampleFutureSlot.id,
          startTime: sampleFutureSlot.startTime,
          endTime: sampleFutureSlot.endTime,
        },
      ]);
    });

    it("filters out any slot that does not satisfy 24h lead time even if returned by database", async () => {
      vi.mocked(mockSlotRepo.getAvailableSlots).mockResolvedValueOnce([
        sampleLeadTimeViolatingSlot,
        sampleFutureSlot,
      ]);

      const slots = await bookingService.getAvailableSlots();

      expect(slots).toHaveLength(1);
      expect(slots[0].id).toBe(sampleFutureSlot.id);
    });
  });

  describe("Atomic Slot Reservation Flow", () => {
    it("successfully reserves an available slot, detaches stale holds, and creates consultation", async () => {
      const result = await bookingService.reserveSlot(sampleIntakeInput, {
        requestId: "req-123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.consultationId).toBe("consultation-uuid-999");
        expect(result.slotId).toBe("slot-uuid-1");
        expect(result.reservationToken).toHaveLength(64); // 256 bits = 64 hex chars
        expect(result.expiresInSeconds).toBeGreaterThan(800);
      }

      // Verify sequence:
      // 1. Atomic reserve
      expect(mockSlotRepo.reserveSlot).toHaveBeenCalledWith(
        "slot-uuid-1",
        expect.any(String),
        15
      );

      // 2. Detach stale holds for this slot
      expect(mockConsultationRepo.detachStaleSlotHold).toHaveBeenCalledWith("slot-uuid-1");

      // 3. Create consultation with slot_held status
      expect(mockConsultationRepo.createConsultation).toHaveBeenCalledWith(
        expect.objectContaining({
          slotId: "slot-uuid-1",
          status: "slot_held",
          customerFirstName: "Pooja",
          customerLastName: "Sharma",
          requestId: "req-123",
        })
      );
    });

    it("rejects reservation if slot does not exist (INVALID_SLOT)", async () => {
      vi.mocked(mockSlotRepo.getSlotById).mockResolvedValueOnce(null);

      const result = await bookingService.reserveSlot(sampleIntakeInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("INVALID_SLOT");
      }
      expect(mockSlotRepo.reserveSlot).not.toHaveBeenCalled();
    });

    it("rejects reservation if slot violates 24h lead time (SLOT_PAST_LEAD_TIME)", async () => {
      vi.mocked(mockSlotRepo.getSlotById).mockResolvedValueOnce(sampleLeadTimeViolatingSlot);

      const result = await bookingService.reserveSlot({
        ...sampleIntakeInput,
        slotId: sampleLeadTimeViolatingSlot.id,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("SLOT_PAST_LEAD_TIME");
      }
      expect(mockSlotRepo.reserveSlot).not.toHaveBeenCalled();
    });

    it("rejects reservation when slot is already reserved or booked (SLOT_UNAVAILABLE)", async () => {
      // Slot exists, but reserveSlot RPC returns null due to concurrent hold or booking
      vi.mocked(mockSlotRepo.reserveSlot).mockResolvedValueOnce(null);

      const result = await bookingService.reserveSlot(sampleIntakeInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("SLOT_UNAVAILABLE");
      }
      expect(mockConsultationRepo.detachStaleSlotHold).not.toHaveBeenCalled();
      expect(mockConsultationRepo.createConsultation).not.toHaveBeenCalled();
    });
  });

  describe("Failure Compensation & Rollback", () => {
    it("releases reserved slot if consultation creation throws an error", async () => {
      vi.mocked(mockConsultationRepo.createConsultation).mockRejectedValueOnce(
        new Error("Database connection dropped during consultation insert")
      );

      const result = await bookingService.reserveSlot(sampleIntakeInput, {
        requestId: "req-fail-1",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("DATABASE_ERROR");
      }

      // Compensation release MUST be triggered with the exact same reservation token
      expect(mockSlotRepo.releaseSlot).toHaveBeenCalledTimes(1);
      expect(mockSlotRepo.releaseSlot).toHaveBeenCalledWith(
        "slot-uuid-1",
        expect.any(String)
      );
    });

    it("handles failure during compensation release gracefully without crashing", async () => {
      vi.mocked(mockConsultationRepo.createConsultation).mockRejectedValueOnce(
        new Error("DB insert failure")
      );
      vi.mocked(mockSlotRepo.releaseSlot).mockRejectedValueOnce(
        new Error("Network timeout during release")
      );

      const result = await bookingService.reserveSlot(sampleIntakeInput);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("DATABASE_ERROR");
      }
    });
  });
});
