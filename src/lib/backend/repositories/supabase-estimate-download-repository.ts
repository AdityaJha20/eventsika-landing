import type { SupabaseClient } from "@supabase/supabase-js";
import type { ValidatedEstimateDownload } from "../validation/estimate-download-schema";

const TABLE = "estimate_download_leads";
const UNIQUE_VIOLATION = "23505";

export interface SavedEstimateDownload {
  id: string;
  /** True when this idempotency key was already stored; no new row was created. */
  duplicate: boolean;
}

/** Same idempotency key re-used for a different contact or selection. */
export class EstimateDownloadKeyConflictError extends Error {
  constructor() {
    super("Idempotency key already used for a different estimate download.");
    this.name = "EstimateDownloadKeyConflictError";
  }
}

/**
 * Database failure. The message carries only the Postgres error code: Supabase
 * error messages and details can quote row values, including the contact.
 */
export class EstimateDownloadStorageError extends Error {
  constructor(public readonly code: string) {
    super(`Estimate download lead could not be stored (code ${code}).`);
    this.name = "EstimateDownloadStorageError";
  }
}

/**
 * Inserts one estimate download lead. A repeated request with the same
 * idempotency key returns the existing row instead of creating another.
 */
export async function saveEstimateDownloadLead(
  client: SupabaseClient,
  input: ValidatedEstimateDownload,
  consentedAt: Date,
): Promise<SavedEstimateDownload> {
  const { data, error } = await client
    .from(TABLE)
    .insert({
      contact_type: input.contactType,
      contact_value: input.contactValue,
      package_tier: input.packageTier,
      guest_count: input.guestCount,
      selected_service_ids: input.serviceIds,
      estimate_snapshot: input.snapshot,
      total_estimate_rupees: input.totalEstimateRupees,
      consent_to_contact: true,
      consent_text_version: input.consentTextVersion,
      consented_at: consentedAt.toISOString(),
      idempotency_key: input.idempotencyKey,
    })
    .select("id")
    .single();

  if (!error && data) return { id: data.id, duplicate: false };
  if (error?.code !== UNIQUE_VIOLATION) throw new EstimateDownloadStorageError(error?.code ?? "unknown");

  const existing = await client
    .from(TABLE)
    .select("id, contact_value, package_tier, guest_count, selected_service_ids")
    .eq("idempotency_key", input.idempotencyKey)
    .single();

  if (existing.error || !existing.data) {
    throw new EstimateDownloadStorageError(existing.error?.code ?? "unknown");
  }

  const row = existing.data;
  const sameRequest =
    row.contact_value === input.contactValue &&
    row.package_tier === input.packageTier &&
    row.guest_count === input.guestCount &&
    Array.isArray(row.selected_service_ids) &&
    row.selected_service_ids.join(",") === input.serviceIds.join(",");
  if (!sameRequest) throw new EstimateDownloadKeyConflictError();

  return { id: row.id, duplicate: true };
}
