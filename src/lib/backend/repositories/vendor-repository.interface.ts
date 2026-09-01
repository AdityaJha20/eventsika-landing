import { ValidatedVendorInput } from "../validation/vendor-schema";

export interface SavedVendorRecord extends ValidatedVendorInput {
  id: string;
  createdAt: string;
}

export interface IVendorRepository {
  /**
   * Persists a validated vendor partner application.
   * In Day 2 this is backed by an in-memory/no-op store;
   * in Day 7 this will be backed by the selected production database.
   */
  saveVendorApplication(vendor: ValidatedVendorInput): Promise<SavedVendorRecord>;
}
