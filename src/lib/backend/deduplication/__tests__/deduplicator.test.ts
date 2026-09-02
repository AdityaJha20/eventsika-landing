import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  deduplicator,
  generateLeadDeduplicationKey,
  generateVendorDeduplicationKey,
} from "../deduplicator";

describe("RequestDeduplicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    deduplicator.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Observable business behavior", () => {
    it("allows the initial submission and returns isDuplicate: false", () => {
      const key = generateLeadDeduplicationKey("9876543210", "Birthday", "2026-12-25", "Delhi");
      const isDuplicate = deduplicator.isDuplicate(key, 30000);
      expect(isDuplicate).toBe(false);
    });

    it("identifies rapid duplicate submissions within 30 seconds and returns isDuplicate: true", () => {
      const key = generateLeadDeduplicationKey("9876543210", "Birthday", "2026-12-25", "Delhi");
      
      // First submission
      expect(deduplicator.isDuplicate(key, 30000)).toBe(false);

      // Rapid duplicate 5 seconds later
      vi.advanceTimersByTime(5000);
      expect(deduplicator.isDuplicate(key, 30000)).toBe(true);

      // Rapid duplicate 20 seconds later
      vi.advanceTimersByTime(15000);
      expect(deduplicator.isDuplicate(key, 30000)).toBe(true);
    });

    it("allows the same submission again after the 30-second window expires", () => {
      const key = generateLeadDeduplicationKey("9876543210", "Birthday", "2026-12-25", "Delhi");
      
      // First submission
      expect(deduplicator.isDuplicate(key, 30000)).toBe(false);

      // Advance time past the 30-second window (31 seconds)
      vi.advanceTimersByTime(31000);

      // Submission becomes acceptable again
      expect(deduplicator.isDuplicate(key, 30000)).toBe(false);
    });

    it("does not collide distinct submission keys", () => {
      const keyA = generateLeadDeduplicationKey("9876543210", "Birthday", "2026-12-25", "Delhi");
      const keyB = generateLeadDeduplicationKey("9876543210", "Anniversary", "2026-12-25", "Delhi");
      const keyC = generateLeadDeduplicationKey("8888888888", "Birthday", "2026-12-25", "Delhi");

      expect(deduplicator.isDuplicate(keyA, 30000)).toBe(false);
      expect(deduplicator.isDuplicate(keyB, 30000)).toBe(false);
      expect(deduplicator.isDuplicate(keyC, 30000)).toBe(false);
    });

    it("correctly generates normalized vendor keys", () => {
      const key1 = generateVendorDeduplicationKey("9876543210", "vikram@royals.in", "Royal Decors");
      const key2 = generateVendorDeduplicationKey("9876543210", "VIKRAM@royals.in", "ROYAL DECORS");
      const key3 = generateVendorDeduplicationKey("9876543210", "other@royals.in", "Royal Decors");

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });
});
