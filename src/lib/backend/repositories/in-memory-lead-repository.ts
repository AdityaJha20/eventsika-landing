import { ValidatedLeadInput } from "../validation/lead-schema";
import { ILeadRepository, SavedLeadRecord } from "./lead-repository.interface";

/**
 * In-Memory Lead Repository
 *
 * Lightweight persistence boundary for Day 2.
 * Stores up to 100 recent submissions in memory.
 * Decouples business logic from database choice until Day 7.
 */
export class InMemoryLeadRepository implements ILeadRepository {
  private records: SavedLeadRecord[] = [];
  private maxRecords: number;

  constructor(maxRecords = 100) {
    this.maxRecords = maxRecords;
  }

  async saveLead(lead: ValidatedLeadInput): Promise<SavedLeadRecord> {
    const record: SavedLeadRecord = {
      ...lead,
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };

    this.records.unshift(record);
    if (this.records.length > this.maxRecords) {
      this.records.pop();
    }

    return record;
  }

  getRecentCount(): number {
    return this.records.length;
  }
}

export const defaultLeadRepository = new InMemoryLeadRepository();
