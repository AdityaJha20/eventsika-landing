import { ValidatedLeadInput } from "../validation/lead-schema";

export interface SavedLeadRecord extends ValidatedLeadInput {
  id: string;
  createdAt: string;
}

export interface ILeadRepository {
  /**
   * Persists a validated lead submission.
   * In Day 2 this is backed by an in-memory/no-op store;
   * in Day 7 this will be backed by the selected production database.
   */
  saveLead(lead: ValidatedLeadInput): Promise<SavedLeadRecord>;
}
