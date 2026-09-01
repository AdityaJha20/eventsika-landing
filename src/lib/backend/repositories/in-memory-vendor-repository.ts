import { ValidatedVendorInput } from "../validation/vendor-schema";
import { IVendorRepository, SavedVendorRecord } from "./vendor-repository.interface";

/**
 * In-Memory Vendor Repository
 *
 * Lightweight persistence boundary for Day 2.
 * Stores up to 100 recent applications in memory.
 * Decouples business logic from database choice until Day 7.
 */
export class InMemoryVendorRepository implements IVendorRepository {
  private records: SavedVendorRecord[] = [];
  private maxRecords: number;

  constructor(maxRecords = 100) {
    this.maxRecords = maxRecords;
  }

  async saveVendorApplication(vendor: ValidatedVendorInput): Promise<SavedVendorRecord> {
    const record: SavedVendorRecord = {
      ...vendor,
      id: `vnd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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

export const defaultVendorRepository = new InMemoryVendorRepository();
