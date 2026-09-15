/**
 * Consultation Booking & Slot Business Domain Service
 *
 * Coordinates availability querying, JIT slot materialization,
 * server-authoritative 24-hour lead time reassertion, atomic slot hold (15m),
 * stale-hold detachment, consultation creation, and compensation release on failure.
 */

import crypto from "crypto";
import { logger } from "../logger/logger";
import { IConsultationSlotRepository } from "../repositories/consultation-slot-repository.interface";
import { SupabaseConsultationSlotRepository } from "../repositories/supabase-consultation-slot-repository";
import { IConsultationRepository } from "../repositories/consultation-repository.interface";
import { SupabaseConsultationRepository } from "../repositories/supabase-consultation-repository";
import {
  AvailableSlotDto,
  RESERVATION_HOLD_DURATION_MINUTES,
  SlotReservationResult,
} from "../types/payment-and-consultation";
import {
  clampAvailabilityRange,
  generateSlotsForDateRange,
  isPastLeadTime,
} from "../utils/consultation-time";
import { ValidatedConsultationInput } from "../validation/consultation-schema";

export class ConsultationBookingService {
  private slotRepo: IConsultationSlotRepository;
  private consultationRepo: IConsultationRepository;

  constructor(
    slotRepo?: IConsultationSlotRepository,
    consultationRepo?: IConsultationRepository
  ) {
    this.slotRepo = slotRepo || new SupabaseConsultationSlotRepository();
    this.consultationRepo = consultationRepo || new SupabaseConsultationRepository();
  }

  /**
   * Retrieves available consultation slots within the server-authoritative 30-day window.
   * Lazily materializes fixed slots for missing dates before querying.
   */
  async getAvailableSlots(query?: {
    startDate?: string | null;
    endDate?: string | null;
    serverNow?: Date;
  }): Promise<AvailableSlotDto[]> {
    const serverNow = query?.serverNow || new Date();

    // 1. Calculate clamped availability range [serverNow + 24h, serverNow + 30d]
    const { effectiveStart, effectiveEnd } = clampAvailabilityRange(
      serverNow,
      query?.startDate,
      query?.endDate
    );

    // 2. JIT Slot Materialization: generate fixed slots and bulk insert with ON CONFLICT DO NOTHING
    try {
      const prospectiveSlots = generateSlotsForDateRange(effectiveStart, effectiveEnd);
      if (prospectiveSlots.length > 0) {
        await this.slotRepo.bulkCreateSlots(
          prospectiveSlots.map((s) => ({
            startTime: s.startTime,
            endTime: s.endTime,
            status: "available",
          }))
        );
      }
    } catch (err) {
      // Non-fatal logging: existing slots in DB can still be retrieved even if bulk insert encounters warning
      logger.warn("JIT slot materialization warning (continuing to fetch inventory)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 3. Query available inventory (including expired reservations)
    const slotRecords = await this.slotRepo.getAvailableSlots(
      effectiveStart.toISOString(),
      effectiveEnd.toISOString()
    );

    // 4. Filter strictly by minimum 24-hour lead time and map to public DTO
    return slotRecords
      .filter((slot) => !isPastLeadTime(slot.startTime, serverNow))
      .map((slot) => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }));
  }

  /**
   * Two-Step Slot Reservation Flow with Compensation:
   * 1. Validate slot exists and satisfies 24h lead time.
   * 2. Atomically reserve slot for 15 minutes via database RPC.
   * 3. Detach any stale hold from prior expired reservation on this slot.
   * 4. Persist consultation record with status = 'slot_held'.
   * 5. Compensate by releasing slot if consultation insert fails.
   */
  async reserveSlot(
    input: ValidatedConsultationInput,
    context?: { requestId?: string; clientIp?: string; serverNow?: Date }
  ): Promise<SlotReservationResult> {
    const requestId = context?.requestId;
    const serverNow = context?.serverNow || new Date();

    if (!input.slotId) {
      return {
        success: false,
        error: "INVALID_SLOT",
        message: "Please select an available consultation slot.",
      };
    }

    // Step 1: Slot identity and lead-time verification
    let targetSlot;
    try {
      targetSlot = await this.slotRepo.getSlotById(input.slotId);
    } catch (err) {
      logger.error("Failed to lookup consultation slot for reservation", err, {
        requestId,
        slotId: input.slotId,
      });
      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Unable to verify slot availability. Please try again.",
      };
    }

    if (!targetSlot) {
      return {
        success: false,
        error: "INVALID_SLOT",
        message: "The selected consultation slot could not be found.",
      };
    }

    // Re-assert minimum 24-hour lead time on the server
    if (isPastLeadTime(targetSlot.startTime, serverNow)) {
      return {
        success: false,
        error: "SLOT_PAST_LEAD_TIME",
        message: "Consultation slots must be reserved at least 24 hours in advance.",
      };
    }

    // Step 2: Generate 256-bit cryptographically secure reservation token
    const reservationToken = crypto.randomBytes(32).toString("hex");

    // Step 3: Atomic reservation via database RPC
    let reservedSlot;
    try {
      reservedSlot = await this.slotRepo.reserveSlot(
        input.slotId,
        reservationToken,
        RESERVATION_HOLD_DURATION_MINUTES
      );
    } catch (err) {
      logger.error("Atomic slot reservation RPC encountered error", err, {
        requestId,
        slotId: input.slotId,
      });
      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Failed to reserve slot due to a temporary system error.",
      };
    }

    // Competing customer won the race or slot is already booked/blocked
    if (!reservedSlot) {
      return {
        success: false,
        error: "SLOT_UNAVAILABLE",
        message: "This slot has just been reserved by another customer. Please choose another time.",
      };
    }

    // Step 4: Stale Hold Detachment
    // Now that this customer holds the slot lock, detach any prior expired hold
    try {
      await this.consultationRepo.detachStaleSlotHold(input.slotId);
    } catch (err) {
      logger.warn("Warning during stale hold detachment (continuing with consultation creation)", {
        requestId,
        slotId: input.slotId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Step 5: Persist Consultation Record with status = 'slot_held'
    let savedConsultation;
    try {
      savedConsultation = await this.consultationRepo.createConsultation({
        slotId: input.slotId,
        customerFirstName: input.customerFirstName,
        customerLastName: input.customerLastName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        customerCity: input.customerCity,
        eventType: input.eventType,
        eventTypeOther: input.eventTypeOther,
        guestCount: input.guestCount,
        eventDateApprox: input.eventDateApprox,
        meetingChannel: input.meetingChannel,
        status: "slot_held",
        requestId: requestId || null,
      });
    } catch (createErr) {
      // Step 6: Compensation on failure: release the held slot immediately
      logger.error(
        "Consultation insert failed after slot hold; executing compensation release",
        createErr,
        { requestId, slotId: input.slotId }
      );

      try {
        await this.slotRepo.releaseSlot(input.slotId, reservationToken);
      } catch (releaseErr) {
        logger.error(
          "Compensation release failed; slot will self-recover via lazy expiry in 15 minutes",
          releaseErr,
          { requestId, slotId: input.slotId }
        );
      }

      return {
        success: false,
        error: "DATABASE_ERROR",
        message: "Unable to create your consultation record. Please try again.",
      };
    }

    const reservedUntil =
      reservedSlot.reservedUntil ||
      new Date(Date.now() + RESERVATION_HOLD_DURATION_MINUTES * 60 * 1000).toISOString();

    const expiresInSeconds = Math.max(
      0,
      Math.floor((new Date(reservedUntil).getTime() - Date.now()) / 1000)
    );

    return {
      success: true,
      consultationId: savedConsultation.id,
      slotId: reservedSlot.id,
      reservationToken,
      reservedUntil,
      expiresInSeconds,
    };
  }
}

export const consultationBookingService = new ConsultationBookingService();
