import {
  ConsultationSlotRecord,
  CreateConsultationSlotInput,
  SlotStatus,
} from "../types/payment-and-consultation";

export interface IConsultationSlotRepository {
  /**
   * Persists a consultation slot in inventory.
   */
  createSlot(slot: CreateConsultationSlotInput): Promise<ConsultationSlotRecord>;

  /**
   * Retrieves a consultation slot by its unique ID.
   */
  getSlotById(id: string): Promise<ConsultationSlotRecord | null>;

  /**
   * Retrieves all consultation slots falling within a time window.
   */
  getSlotsByTimeRange(startTime: string, endTime: string): Promise<ConsultationSlotRecord[]>;

  /**
   * Updates slot status and reservation metadata.
   */
  updateSlotStatus(
    id: string,
    status: SlotStatus,
    metadata?: {
      reservedUntil?: string | null;
      reservationToken?: string | null;
    }
  ): Promise<ConsultationSlotRecord>;

  /**
   * Retrieves slots in range that are available or whose reservation has expired.
   */
  getAvailableSlots(startTime: string, endTime: string): Promise<ConsultationSlotRecord[]>;

  /**
   * Bulk inserts slots idempotently (ignores conflicts on start_time).
   */
  bulkCreateSlots(slots: CreateConsultationSlotInput[]): Promise<ConsultationSlotRecord[]>;

  /**
   * Atomically reserves a slot for holdDurationMinutes using database RPC.
   * Returns updated slot if reserved, or null if already reserved/booked/blocked.
   */
  reserveSlot(
    slotId: string,
    reservationToken: string,
    holdDurationMinutes?: number
  ): Promise<ConsultationSlotRecord | null>;

  /**
   * Releases a slot reservation if matching reservationToken.
   * Returns true if successfully released.
   */
  releaseSlot(slotId: string, reservationToken: string): Promise<boolean>;

  /**
   * Confirms a slot reservation into booked status if matching reservationToken and not expired.
   * Returns updated slot if confirmed, or null if token mismatch or expired.
   */
  confirmSlot(slotId: string, reservationToken: string): Promise<ConsultationSlotRecord | null>;
}
