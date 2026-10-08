import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkAdminLoginRateLimit, _setAdminRateLimitStoreForTesting, _resetAdminRateLimitsForTesting, IAdminRateLimitStore } from "../rate-limit";

describe("Admin Rate Limiting Error Paths", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetAdminRateLimitsForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetAdminRateLimitsForTesting();
  });

  it("fails closed in production environment when store.checkLimits throws", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const mockStore: IAdminRateLimitStore = {
      checkLimits: vi.fn().mockRejectedValue(new Error("Datastore failed")),
      recordFailure: vi.fn(),
      recordSuccess: vi.fn(),
      clear: vi.fn(),
    };

    _setAdminRateLimitStoreForTesting(mockStore);

    const fakeRequest = new Request("http://localhost:3000/api/admin/login", {
      headers: { "x-real-ip": "198.51.100.77" },
    });

    const result = await checkAdminLoginRateLimit(fakeRequest, "admin@example.com");

    expect(result).toEqual({
      isAllowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
      isUnavailable: true,
    });
  });

  it("fails open in non-production environment when store.checkLimits throws", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const mockStore: IAdminRateLimitStore = {
      checkLimits: vi.fn().mockRejectedValue(new Error("Datastore failed")),
      recordFailure: vi.fn(),
      recordSuccess: vi.fn(),
      clear: vi.fn(),
    };

    _setAdminRateLimitStoreForTesting(mockStore);

    const fakeRequest = new Request("http://localhost:3000/api/admin/login", {
      headers: { "x-real-ip": "198.51.100.77" },
    });

    const result = await checkAdminLoginRateLimit(fakeRequest, "admin@example.com");

    expect(result).toEqual({
      isAllowed: true,
      remaining: 5,
      retryAfterSeconds: 0,
    });
  });
});
