/**
 * In-Memory Request Deduplicator
 *
 * Protects public submission endpoints against rapid duplicate clicks/submissions
 * within a sliding time window (e.g. 30 seconds).
 *
 * Note: Uses in-memory storage suitable for single-process Node.js deployment.
 * Can be replaced by a Redis/distributed store in later stages.
 */

class RequestDeduplicator {
  private store: Map<string, number> = new Map();
  private defaultWindowMs: number;

  constructor(defaultWindowMs = 30_000) {
    this.defaultWindowMs = defaultWindowMs;

    // Periodic cleanup of expired entries every 2 minutes
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanup(), 120_000).unref?.();
    }
  }

  /**
   * Checks whether the given submission key was received recently.
   * If not seen within windowMs, records it and returns false.
   * If seen within windowMs, returns true (indicating duplicate).
   */
  isDuplicate(key: string, windowMs = this.defaultWindowMs): boolean {
    const now = Date.now();
    const lastSeen = this.store.get(key);

    if (lastSeen && now - lastSeen < windowMs) {
      return true;
    }

    this.store.set(key, now);
    return false;
  }

  /**
   * Removes all entries that have expired.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.store.entries()) {
      if (now - timestamp > this.defaultWindowMs * 2) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Returns current count of active tracked deduplication keys (useful for tests/metrics)
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Clears all entries (useful for testing)
   */
  clear(): void {
    this.store.clear();
  }
}

export const deduplicator = new RequestDeduplicator();

/**
 * Creates a unique fingerprint key for a lead inquiry.
 */
export function generateLeadDeduplicationKey(
  phone: string,
  eventType: string,
  eventDate: string,
  city: string
): string {
  return `lead:${phone}:${eventType}:${eventDate}:${city}`;
}

/**
 * Creates a unique fingerprint key for a vendor application.
 */
export function generateVendorDeduplicationKey(
  phone: string,
  email: string,
  businessName: string
): string {
  return `vendor:${phone}:${email.toLowerCase()}:${businessName.toLowerCase()}`;
}
