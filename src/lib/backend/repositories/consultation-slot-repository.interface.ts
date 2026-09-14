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
}
