import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import {
  ConsultationRecord,
  ConsultationStatus,
  CreateConsultationInput,
  MeetingChannel,
} from "../types/payment-and-consultation";
import { IConsultationRepository } from "./consultation-repository.interface";

export class SupabaseConsultationRepository implements IConsultationRepository {
  private client: SupabaseClient | null;

  constructor(client?: SupabaseClient | null) {
    this.client = client !== undefined ? client : getSupabaseAdminClient();
  }

  private getClient(): SupabaseClient {
    const client = this.client || getSupabaseAdminClient();
    if (!client) {
      throw new Error("Supabase client is not configured or unavailable.");
    }
    return client;
  }

  private mapRowToRecord(row: Record<string, unknown>): ConsultationRecord {
    return {
      id: String(row.id),
      slotId: typeof row.slot_id === "string" ? row.slot_id : null,
      customerFirstName: String(row.customer_first_name ?? ""),
      customerLastName: String(row.customer_last_name ?? ""),
      customerPhone: String(row.customer_phone ?? ""),
      customerEmail: String(row.customer_email ?? ""),
      customerCity: String(row.customer_city ?? ""),
      eventType: String(row.event_type ?? ""),
      eventTypeOther: typeof row.event_type_other === "string" ? row.event_type_other : null,
      guestCount: typeof row.guest_count === "string" ? row.guest_count : (row.guest_count !== null && row.guest_count !== undefined ? String(row.guest_count) : null),
      eventDateApprox: typeof row.event_date_approx === "string" ? row.event_date_approx : null,
      meetingChannel: row.meeting_channel as MeetingChannel,
      status: row.status as ConsultationStatus,
      cancellationReason: typeof row.cancellation_reason === "string" ? row.cancellation_reason : null,
      rescheduledFromId: typeof row.rescheduled_from_id === "string" ? row.rescheduled_from_id : null,
      rescheduleCount: typeof row.reschedule_count === "number" ? row.reschedule_count : 0,
      requestId: typeof row.request_id === "string" ? row.request_id : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async createConsultation(consultation: CreateConsultationInput): Promise<ConsultationRecord> {
    const client = this.getClient();
    const { data, error } = await client
      .from("consultations")
      .insert({
        slot_id: consultation.slotId || null,
        customer_first_name: consultation.customerFirstName,
        customer_last_name: consultation.customerLastName,
        customer_phone: consultation.customerPhone,
        customer_email: consultation.customerEmail,
        customer_city: consultation.customerCity,
        event_type: consultation.eventType,
        event_type_other: consultation.eventTypeOther || null,
        guest_count: consultation.guestCount || null,
        event_date_approx: consultation.eventDateApprox || null,
        meeting_channel: consultation.meetingChannel,
        status: consultation.status || "draft",
        request_id: consultation.requestId || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error creating consultation: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }

  async getConsultationById(id: string): Promise<ConsultationRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from("consultations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching consultation: ${error.message}`);
    }

    return data ? this.mapRowToRecord(data) : null;
  }

  async updateConsultationStatus(
    id: string,
    status: ConsultationStatus,
    details?: {
      cancellationReason?: string | null;
      slotId?: string | null;
    }
  ): Promise<ConsultationRecord> {
    const client = this.getClient();
    const updates: Record<string, unknown> = { status };
    if (details?.cancellationReason !== undefined) {
      updates.cancellation_reason = details.cancellationReason;
    }
    if (details?.slotId !== undefined) {
      updates.slot_id = details.slotId;
    }

    const { data, error } = await client
      .from("consultations")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error updating consultation status: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }
}
