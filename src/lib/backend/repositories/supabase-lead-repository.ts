import { SupabaseClient } from "@supabase/supabase-js";
import { ValidatedLeadInput } from "../validation/lead-schema";
import { ILeadRepository, SavedLeadRecord } from "./lead-repository.interface";
import { getSupabaseAdminClient } from "../supabase/client";

/**
 * Supabase Lead Repository
 *
 * Implements ILeadRepository to persist validated celebration leads
 * directly to the Supabase PostgreSQL `leads` table.
 */
export class SupabaseLeadRepository implements ILeadRepository {
  private client: SupabaseClient | null;

  constructor(client?: SupabaseClient | null) {
    this.client = client !== undefined ? client : getSupabaseAdminClient();
  }

  async saveLead(
    lead: ValidatedLeadInput,
    context?: { requestId?: string }
  ): Promise<SavedLeadRecord> {
    if (lead.isBot) {
      return {
        ...lead,
        id: "bot_filtered",
        createdAt: new Date().toISOString(),
      };
    }

    const client = this.client || getSupabaseAdminClient();
    if (!client) {
      throw new Error("Supabase client is not configured or unavailable.");
    }

    const { data, error } = await client
      .from("leads")
      .insert({
        user_name: lead.userName,
        user_phone: lead.userPhone,
        city: lead.city,
        event_type: lead.eventType,
        event_date: lead.eventDate,
        guest_count: lead.guestCount,
        venue_type: lead.venueType,
        selected_services: lead.selectedServices,
        budget_range: lead.budgetRange,
        whatsapp_consent: lead.whatsappConsent,
        request_id: context?.requestId || null,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      const errorMsg = error?.message || "Unknown database insert error";
      throw new Error(`Database error saving lead: ${errorMsg}`);
    }

    return {
      ...lead,
      id: data.id,
      createdAt: data.created_at,
    };
  }
}
