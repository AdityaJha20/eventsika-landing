import { SupabaseClient } from "@supabase/supabase-js";
import { ValidatedVendorInput } from "../validation/vendor-schema";
import { IVendorRepository, SavedVendorRecord } from "./vendor-repository.interface";
import { getSupabaseAdminClient } from "../supabase/client";

/**
 * Supabase Vendor Repository
 *
 * Implements IVendorRepository to persist validated partner applications
 * directly to the Supabase PostgreSQL `vendor_applications` table.
 */
export class SupabaseVendorRepository implements IVendorRepository {
  private client: SupabaseClient | null;

  constructor(client?: SupabaseClient | null) {
    this.client = client !== undefined ? client : getSupabaseAdminClient();
  }

  async saveVendorApplication(
    vendor: ValidatedVendorInput,
    context?: { requestId?: string }
  ): Promise<SavedVendorRecord> {
    if (vendor.isBot) {
      return {
        ...vendor,
        id: "bot_filtered",
        createdAt: new Date().toISOString(),
      };
    }

    const client = this.client || getSupabaseAdminClient();
    if (!client) {
      throw new Error("Supabase client is not configured or unavailable.");
    }

    const { data, error } = await client
      .from("vendor_applications")
      .insert({
        business_name: vendor.businessName,
        contact_name: vendor.contactName,
        phone: vendor.phone,
        email: vendor.email,
        city: vendor.city,
        experience: vendor.experience,
        portfolio_url: vendor.portfolioUrl,
        categories: vendor.categories,
        request_id: context?.requestId || null,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      const errorMsg = error?.message || "Unknown database insert error";
      throw new Error(`Database error saving vendor application: ${errorMsg}`);
    }

    return {
      ...vendor,
      id: data.id,
      createdAt: data.created_at,
    };
  }
}
