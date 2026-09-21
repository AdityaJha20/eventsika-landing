import { describe, it, expect } from "vitest";
import { mapBookingError } from "../error-mapping";

describe("Error Mapping Utilities", () => {
  it("maps rate limit 429 correctly", () => {
    const msg = mapBookingError(undefined, 429);
    expect(msg).toContain("several attempts");
  });

  it("maps cross-origin/CSRF 403 correctly", () => {
    const msg = mapBookingError(undefined, 403);
    expect(msg).toContain("security validation");
  });

  it("maps payload too large 413 correctly", () => {
    const msg = mapBookingError(undefined, 413);
    expect(msg).toContain("too large");
  });

  it("maps known backend codes to user-friendly copy", () => {
    expect(mapBookingError("SLOT_UNAVAILABLE")).toContain("reserved by another guest");
    expect(mapBookingError("SLOT_PAST_LEAD_TIME")).toContain("24 hours advance");
    expect(mapBookingError("RESERVATION_EXPIRING_SOON")).toContain("less than 2 minutes");
    expect(mapBookingError("RESERVATION_EXPIRED")).toContain("15-minute reservation hold has expired");
    expect(mapBookingError("PAYMENT_ALREADY_COMPLETED")).toContain("already been recorded");
    expect(mapBookingError("GATEWAY_TIMEOUT")).toContain("took too long to respond");
    expect(mapBookingError("GATEWAY_ERROR")).toContain("momentarily experiencing high traffic");
  });

  it("falls back to friendly message for unknown errors", () => {
    expect(mapBookingError("")).toContain("momentary issue");
    expect(mapBookingError("Error: Database crash at line 50")).toContain("unexpected issue");
  });
});
