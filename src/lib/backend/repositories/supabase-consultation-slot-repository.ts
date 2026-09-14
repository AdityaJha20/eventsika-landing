import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "../supabase/client";
import {
  ConsultationSlotRecord,
  CreateConsultationSlotInput,
  SlotStatus,
} from "../types/payment-and-consultation";
import { IConsultationSlotRepository } from "./consultation-slot-repository.interface";

export class SupabaseConsultationSlotRepository implements IConsultationSlotRepository {
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

  private mapRowToRecord(row: Record<string, unknown>): ConsultationSlotRecord {
    return {
      id: String(row.id),
      startTime: String(row.start_time),
      endTime: String(row.end_time),
      status: row.status as SlotStatus,
      reservedUntil: typeof row.reserved_until === "string" ? row.reserved_until : null,
      reservationToken: typeof row.reservation_token === "string" ? row.reservation_token : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async createSlot(slot: CreateConsultationSlotInput): Promise<ConsultationSlotRecord> {
    const client = this.getClient();
    const { data, error } = await client
      .from("consultation_slots")
      .insert({
        start_time: slot.startTime,
        end_time: slot.endTime,
        status: slot.status || "available",
        reserved_until: slot.reservedUntil || null,
        reservation_token: slot.reservationToken || null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error creating consultation slot: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }

  async getSlotById(id: string): Promise<ConsultationSlotRecord | null> {
    const client = this.getClient();
    const { data, error } = await client
      .from("consultation_slots")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Database error fetching consultation slot: ${error.message}`);
    }

    return data ? this.mapRowToRecord(data) : null;
  }

  async getSlotsByTimeRange(startTime: string, endTime: string): Promise<ConsultationSlotRecord[]> {
    const client = this.getClient();
    const { data, error } = await client
      .from("consultation_slots")
      .select("*")
      .gte("start_time", startTime)
      .lte("end_time", endTime)
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(`Database error querying consultation slots: ${error.message}`);
    }

    return (data || []).map((row) => this.mapRowToRecord(row));
  }

  async updateSlotStatus(
    id: string,
    status: SlotStatus,
    metadata?: {
      reservedUntil?: string | null;
      reservationToken?: string | null;
    }
  ): Promise<ConsultationSlotRecord> {
    const client = this.getClient();
    const updates: Record<string, unknown> = { status };
    if (metadata?.reservedUntil !== undefined) {
      updates.reserved_until = metadata.reservedUntil;
    }
    if (metadata?.reservationToken !== undefined) {
      updates.reservation_token = metadata.reservationToken;
    }

    const { data, error } = await client
      .from("consultation_slots")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Database error updating consultation slot status: ${error?.message || "Unknown error"}`);
    }

    return this.mapRowToRecord(data);
  }
}
