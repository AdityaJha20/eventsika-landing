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

  async getAvailableSlots(startTime: string, endTime: string): Promise<ConsultationSlotRecord[]> {
    const client = this.getClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await client
      .from("consultation_slots")
      .select("*")
      .gte("start_time", startTime)
      .lte("end_time", endTime)
      .or(`status.eq.available,and(status.eq.reserved,reserved_until.lt.${nowIso})`)
      .order("start_time", { ascending: true });

    if (error) {
      throw new Error(`Database error querying available consultation slots: ${error.message}`);
    }

    return (data || []).map((row) => this.mapRowToRecord(row));
  }

  async bulkCreateSlots(slots: CreateConsultationSlotInput[]): Promise<ConsultationSlotRecord[]> {
    if (slots.length === 0) return [];
    const client = this.getClient();
    const payload = slots.map((s) => ({
      start_time: s.startTime,
      end_time: s.endTime,
      status: s.status || "available",
      reserved_until: s.reservedUntil || null,
      reservation_token: s.reservationToken || null,
    }));

    const { data, error } = await client
      .from("consultation_slots")
      .upsert(payload, { onConflict: "start_time", ignoreDuplicates: true })
      .select("*");

    if (error) {
      throw new Error(`Database error bulk creating consultation slots: ${error.message}`);
    }

    return (data || []).map((row) => this.mapRowToRecord(row));
  }

  async reserveSlot(
    slotId: string,
    reservationToken: string,
    holdDurationMinutes: number = 15
  ): Promise<ConsultationSlotRecord | null> {
    const client = this.getClient();
    const { data, error } = await client.rpc("reserve_consultation_slot", {
      p_slot_id: slotId,
      p_reservation_token: reservationToken,
      p_hold_duration_minutes: holdDurationMinutes,
    });

    if (error) {
      throw new Error(`Database error reserving consultation slot: ${error.message}`);
    }

    if (!data || !(data as Record<string, unknown>).id) {
      return null;
    }

    return this.mapRowToRecord(data as Record<string, unknown>);
  }

  async releaseSlot(slotId: string, reservationToken: string): Promise<boolean> {
    const client = this.getClient();
    const { data, error } = await client.rpc("release_consultation_slot", {
      p_slot_id: slotId,
      p_reservation_token: reservationToken,
    });

    if (error) {
      throw new Error(`Database error releasing consultation slot: ${error.message}`);
    }

    return Boolean(data && (data as Record<string, unknown>).id);
  }

  async confirmSlot(slotId: string, reservationToken: string): Promise<ConsultationSlotRecord | null> {
    const client = this.getClient();
    const { data, error } = await client.rpc("confirm_consultation_slot", {
      p_slot_id: slotId,
      p_reservation_token: reservationToken,
    });

    if (error) {
      throw new Error(`Database error confirming consultation slot: ${error.message}`);
    }

    if (!data || !(data as Record<string, unknown>).id) {
      return null;
    }

    return this.mapRowToRecord(data as Record<string, unknown>);
  }
}
