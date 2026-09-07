import { ValidatedLeadInput } from "../validation/lead-schema";

export interface SavedLeadRecord extends ValidatedLeadInput {
  id: string;
  createdAt: string;
  requestId?: string | null;
  updatedAt?: string;
}

export interface ILeadRepository {
  /**
   * Persists a validated lead submission.
   * Backed by Supabase PostgreSQL in production, with in-memory fallback.
   */
  saveLead(lead: ValidatedLeadInput, context?: { requestId?: string }): Promise<SavedLeadRecord>;

  /**
   * Retrieves all celebration inquiries.
   */
  getAllLeads(): Promise<SavedLeadRecord[]>;
}


