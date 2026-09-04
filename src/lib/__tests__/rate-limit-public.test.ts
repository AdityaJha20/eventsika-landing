import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit, _resetAdminRateLimitsForTesting, UpstashRedisRateLimitStore } from "../rate-limit";
import { Redis } from "@upstash/redis";

describe("Public Distributed & In-Memory Rate Limiting (src/lib/rate-limit.ts)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetAdminRateLimitsForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetAdminRateLimitsForTesting();
  });

  it("permits initial 5 requests and blocks 6th with HTTP 429 semantics in development", async () => {
    const fakeRequest = new Request("http://localhost:3000/api/leads", {
      headers: { "x-real-ip": "198.51.100.77" },
    });

    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit(fakeRequest, "leads", { limit: 5, windowMs: 600_000 });
      expect(result.isAllowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
    }

    const blockedResult = await checkRateLimit(fakeRequest, "leads", { limit: 5, windowMs: 600_000 });
    expect(blockedResult.isAllowed).toBe(false);
    expect(blockedResult.remaining).toBe(0);
    expect(blockedResult.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("executes atomic Lua script with finite TTL when UpstashRedisRateLimitStore is queried", async () => {
    const mockEval = vi.fn().mockResolvedValueOnce([1, 600]);
    const mockRedis = {
      eval: mockEval,
    };

    const redisStore = new UpstashRedisRateLimitStore(mockRedis as unknown as Redis);

    // Test first attempt: allowed
    const res1 = await redisStore.checkNamespaceLimit("198.51.100.80", "leads", 5, 600);
    expect(res1.isAllowed).toBe(true);
    expect(res1.remaining).toBe(4);
    expect(mockEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('INCR', KEYS[1])"),
      ["eventsika:rate:leads:198.51.100.80"],
      [600]
    );

    // Test 6th attempt: blocked
    mockEval.mockResolvedValueOnce([6, 580]);
    const res6 = await redisStore.checkNamespaceLimit("198.51.100.80", "leads", 5, 600);
    expect(res6.isAllowed).toBe(false);
    expect(res6.remaining).toBe(0);
    expect(res6.retryAfterSeconds).toBe(580);
  });

  it("fails closed in production mode when Redis is unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const fakeRequest = new Request("http://localhost:3000/api/leads", {
      headers: { "x-real-ip": "198.51.100.81" },
    });

    const result = await checkRateLimit(fakeRequest, "leads", { limit: 5 });
    expect(result.isAllowed).toBe(false);
    expect(result.isUnavailable).toBe(true);
  });
});
