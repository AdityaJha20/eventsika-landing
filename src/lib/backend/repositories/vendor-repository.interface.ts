import { ValidatedVendorInput } from "../validation/vendor-schema";

export interface SavedVendorRecord extends ValidatedVendorInput {
  id: string;
  createdAt: string;
}

export interface IVendorRepository {
  /**
   * Persists a validated vendor partner application.
   * Backed by Supabase PostgreSQL in production, with in-memory fallback.
   */
  saveVendorApplication(vendor: ValidatedVendorInput, context?: { requestId?: string }): Promise<SavedVendorRecord>;
}

