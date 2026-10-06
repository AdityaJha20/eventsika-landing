import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recordAdminLoginFailure, _setAdminRateLimitStoreForTesting, _resetAdminRateLimitsForTesting, IAdminRateLimitStore } from "../rate-limit";
import { logger } from "@/lib/backend/logger/logger";

describe("Admin Distributed & In-Memory Rate Limiting (src/lib/rate-limit.ts)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetAdminRateLimitsForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetAdminRateLimitsForTesting();
  });

  it("swallows error and logs it when recordFailure throws", async () => {
    const fakeRequest = new Request("http://localhost:3000/api/admin/login", {
      headers: { "x-real-ip": "198.51.100.77" },
    });

    const mockStore: IAdminRateLimitStore = {
      checkLimits: vi.fn(),
      recordFailure: vi.fn().mockRejectedValue(new Error("Redis connection failed")),
      recordSuccess: vi.fn(),
      clear: vi.fn(),
    };

    _setAdminRateLimitStoreForTesting(mockStore);

    const loggerErrorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});

    await expect(recordAdminLoginFailure(fakeRequest, "test@example.com")).resolves.toBeUndefined();

    expect(mockStore.recordFailure).toHaveBeenCalled();
    // Corrected the expected log message to match the actual code implementation
    expect(loggerErrorSpy).toHaveBeenCalledWith("Failed to record admin login failure in datastore", expect.any(Error));
  });
});
