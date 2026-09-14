import {
  ConsultationRecord,
  ConsultationStatus,
  CreateConsultationInput,
} from "../types/payment-and-consultation";

export interface IConsultationRepository {
  /**
   * Persists a new consultation engagement record.
   */
  createConsultation(consultation: CreateConsultationInput): Promise<ConsultationRecord>;

  /**
   * Retrieves a consultation record by its unique ID.
   */
  getConsultationById(id: string): Promise<ConsultationRecord | null>;

  /**
   * Updates consultation status and optional cancellation/reschedule details.
   */
  updateConsultationStatus(
    id: string,
    status: ConsultationStatus,
    details?: {
      cancellationReason?: string | null;
      slotId?: string | null;
    }
  ): Promise<ConsultationRecord>;
}
