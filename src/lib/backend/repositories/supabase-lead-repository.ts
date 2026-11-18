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
        user_email: lead.userEmail,
        city: lead.city,
        event_type: lead.eventType,
        event_date: lead.eventDate,
        guest_count: lead.guestCount,
        venue_type: lead.venueType,
        selected_services: lead.selectedServices,
        budget_range: lead.budgetRange,
        whatsapp_consent: lead.whatsappConsent,
        email_consent: lead.emailConsent,
        request_id: context?.requestId || null,
        // Legacy column names: planning_fee holds the decor package subtotal,
        // vendor_estimate the selected optional services subtotal.
        package_tier: lead.packageQuote?.tierId ?? null,
        package_guest_count: lead.packageQuote?.guestCount ?? null,
        package_vendor_addon_ids: lead.packageQuote?.serviceIds ?? [],
        package_planning_fee_rupees: lead.packageQuote?.packageSubtotalRupees ?? null,
        package_vendor_estimate_rupees: lead.packageQuote?.servicesSubtotalRupees ?? null,
        package_combined_estimate_rupees: lead.packageQuote?.totalEstimateRupees ?? null,
        // Only sent with a quote, so plain enquiries never depend on the newer column.
        ...(lead.packageQuote?.snapshot ? { package_estimate_snapshot: lead.packageQuote.snapshot } : {}),
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

  async getAllLeads(): Promise<SavedLeadRecord[]> {
    const client = this.client || getSupabaseAdminClient();
    if (!client) {
      throw new Error("Supabase client is not configured or unavailable.");
    }

    const { data, error } = await client
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Database error retrieving leads: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      userName: row.user_name,
      userPhone: row.user_phone,
      userEmail: row.user_email ?? "",
      city: row.city,
      eventType: row.event_type,
      eventDate: row.event_date,
      guestCount: row.guest_count,
      venueType: row.venue_type,
      selectedServices: Array.isArray(row.selected_services) ? row.selected_services : [],
      budgetRange: row.budget_range,
      whatsappConsent: Boolean(row.whatsapp_consent),
      emailConsent: row.email_consent === true,
      isBot: false,
      requestId: row.request_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      packageQuote:
        typeof row.package_tier === "string" &&
        typeof row.package_guest_count === "number" &&
        typeof row.package_planning_fee_rupees === "number" &&
        typeof row.package_vendor_estimate_rupees === "number" &&
        typeof row.package_combined_estimate_rupees === "number"
          ? {
              tierId: row.package_tier as NonNullable<ValidatedLeadInput["packageQuote"]>["tierId"],
              guestCount: row.package_guest_count,
              serviceIds: Array.isArray(row.package_vendor_addon_ids)
                ? row.package_vendor_addon_ids.filter((id: unknown): id is string => typeof id === "string")
                : [],
              packageSubtotalRupees: row.package_planning_fee_rupees,
              servicesSubtotalRupees: row.package_vendor_estimate_rupees,
              totalEstimateRupees: row.package_combined_estimate_rupees,
              ...(row.package_estimate_snapshot && typeof row.package_estimate_snapshot === "object"
                ? { snapshot: row.package_estimate_snapshot }
                : {}),
            }
          : null,
    }));
  }
}

