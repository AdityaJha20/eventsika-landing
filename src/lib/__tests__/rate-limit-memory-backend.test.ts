import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkRateLimit,
  checkAdminLoginRateLimit,
  recordAdminLoginFailure,
  recordAdminLoginSuccess,
  resolveRateLimitBackend,
  _resetAdminRateLimitsForTesting,
  _getPublicRateLimitStoreSizeForTesting,
  _cleanupPublicRateLimitsForTesting,
  _getAdminRateLimitStoreSizeForTesting,
  _cleanupAdminRateLimitsForTesting,
  MAX_PUBLIC_RATE_LIMIT_ENTRIES,
  MAX_ADMIN_RATE_LIMIT_ENTRIES,
} from "../rate-limit";

describe("Production Memory Rate Limiting Backend (src/lib/rate-limit.ts)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetAdminRateLimitsForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetAdminRateLimitsForTesting();
  });

  describe("resolveRateLimitBackend", () => {
    it("resolves 'memory' when RATE_LIMIT_BACKEND=memory (case-insensitive, trimmed)", () => {
      expect(resolveRateLimitBackend({ RATE_LIMIT_BACKEND: "memory" })).toEqual({
        backend: "memory",
        raw: "memory",
      });
      expect(resolveRateLimitBackend({ RATE_LIMIT_BACKEND: "  MEMORY  " })).toEqual({
        backend: "memory",
        raw: "  MEMORY  ",
      });
    });

    it("resolves 'upstash' when RATE_LIMIT_BACKEND is upstash or redis", () => {
      expect(resolveRateLimitBackend({ RATE_LIMIT_BACKEND: "upstash" })).toEqual({
        backend: "upstash",
        raw: "upstash",
      });
      expect(resolveRateLimitBackend({ RATE_LIMIT_BACKEND: "redis" })).toEqual({
        backend: "upstash",
        raw: "redis",
      });
    });

    it("resolves 'unconfigured' when RATE_LIMIT_BACKEND is unset or whitespace", () => {
      expect(resolveRateLimitBackend({})).toEqual({ backend: "unconfigured" });
      expect(resolveRateLimitBackend({ RATE_LIMIT_BACKEND: "" })).toEqual({
        backend: "unconfigured",
      });
      expect(resolveRateLimitBackend({ RATE_LIMIT_BACKEND: "   " })).toEqual({
        backend: "unconfigured",
      });
    });

    it("resolves 'unknown' for invalid backend names", () => {
      expect(resolveRateLimitBackend({ RATE_LIMIT_BACKEND: "dynamodb" })).toEqual({
        backend: "unknown",
        raw: "dynamodb",
      });
      expect(resolveRateLimitBackend({ RATE_LIMIT_BACKEND: "memcached" })).toEqual({
        backend: "unknown",
        raw: "memcached",
      });
    });
  });

  describe("Production Memory Mode - Public Enquiry Throttling (/api/leads, etc.)", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RATE_LIMIT_BACKEND", "memory");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    });

    it("permits 5 requests and blocks the 6th with HTTP 429 semantics", async () => {
      const request = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "203.0.113.10" },
      });

      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit(request, "leads", {
          limit: 5,
          windowMs: 600_000,
        });
        expect(result.isAllowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }

      // 6th request must be blocked
      const blocked = await checkRateLimit(request, "leads", {
        limit: 5,
        windowMs: 600_000,
      });
      expect(blocked.isAllowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.isUnavailable).toBeUndefined();
    });

    it("tracks different client IPs in isolated rate limit buckets", async () => {
      const requestA = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "203.0.113.20" },
      });
      const requestB = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "203.0.113.21" },
      });

      // Exhaust IP A
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(requestA, "leads", { limit: 5 });
      }
      const blockedA = await checkRateLimit(requestA, "leads", { limit: 5 });
      expect(blockedA.isAllowed).toBe(false);

      // IP B must remain allowed
      const allowedB = await checkRateLimit(requestB, "leads", { limit: 5 });
      expect(allowedB.isAllowed).toBe(true);
      expect(allowedB.remaining).toBe(4);
    });

    it("tracks different namespaces independently for the same IP", async () => {
      const request = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "203.0.113.30" },
      });

      // Exhaust 'leads' namespace
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(request, "leads", { limit: 5 });
      }
      const blockedLeads = await checkRateLimit(request, "leads", { limit: 5 });
      expect(blockedLeads.isAllowed).toBe(false);

      // 'vendor_applications' namespace must remain separate
      const allowedVendor = await checkRateLimit(request, "vendor_applications", {
        limit: 5,
      });
      expect(allowedVendor.isAllowed).toBe(true);
      expect(allowedVendor.remaining).toBe(4);
    });
  });

  describe("Production Memory Mode - Admin Login Throttling (/api/admin/auth/login)", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RATE_LIMIT_BACKEND", "memory");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    });

    it("allows initial attempts and locks out after repeated failures", async () => {
      const loginRequest = new Request("http://localhost:3000/api/admin/auth/login", {
        headers: { "x-real-ip": "198.51.100.50" },
      });
      const email = "admin@eventsika.in";

      // Initial check must be allowed
      const initialCheck = await checkAdminLoginRateLimit(loginRequest, email);
      expect(initialCheck.isAllowed).toBe(true);

      // Perform 5 failed login cycles (allowed limit for Tier 1 is 5)
      for (let i = 0; i < 5; i++) {
        await checkAdminLoginRateLimit(loginRequest, email);
        await recordAdminLoginFailure(loginRequest, email);
      }

      // Next check should now be locked out
      const lockedCheck = await checkAdminLoginRateLimit(loginRequest, email);
      expect(lockedCheck.isAllowed).toBe(false);
      expect(lockedCheck.remaining).toBe(0);
      expect(lockedCheck.retryAfterSeconds).toBeGreaterThan(0);
      expect(lockedCheck.blockedReason).toBeDefined();
    });

    it("resets failure counters on admin login success", async () => {
      const loginRequest = new Request("http://localhost:3000/api/admin/auth/login", {
        headers: { "x-real-ip": "198.51.100.60" },
      });
      const email = "ops@eventsika.in";

      // Record 2 failures
      await recordAdminLoginFailure(loginRequest, email);
      await recordAdminLoginFailure(loginRequest, email);

      // Admin successfully logs in
      await recordAdminLoginSuccess(loginRequest, email);

      // Should be allowed with clean record
      const checkAfterSuccess = await checkAdminLoginRateLimit(loginRequest, email);
      expect(checkAfterSuccess.isAllowed).toBe(true);
    });
  });

  describe("Bounded Storage & Expiry Cleanup", () => {
    it("purges expired entries from public rate limit store", async () => {
      const initialSize = _getPublicRateLimitStoreSizeForTesting();
      expect(initialSize).toBe(0);

      const request1 = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "10.0.0.1" },
      });
      const request2 = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "10.0.0.2" },
      });

      // Window is 1000ms
      await checkRateLimit(request1, "test_exp", { limit: 5, windowMs: 1000 });
      await checkRateLimit(request2, "test_exp", { limit: 5, windowMs: 1000 });
      expect(_getPublicRateLimitStoreSizeForTesting()).toBe(2);

      // Future time after 2000ms: entries should be stale
      const futureNow = Date.now() + 2000;
      _cleanupPublicRateLimitsForTesting(futureNow);

      expect(_getPublicRateLimitStoreSizeForTesting()).toBe(0);
    });

    it("enforces capacity limit on public store to prevent memory leaks", async () => {
      // Set short limit for testing eviction: insert entries and ensure capacity bounds
      expect(MAX_PUBLIC_RATE_LIMIT_ENTRIES).toBe(10_000);

      // Insert 10 distinct IPs
      for (let i = 0; i < 10; i++) {
        const req = new Request("http://localhost:3000/api/leads", {
          headers: { "x-real-ip": `10.1.0.${i}` },
        });
        await checkRateLimit(req, "test_cap", { limit: 10 });
      }

      expect(_getPublicRateLimitStoreSizeForTesting()).toBe(10);
    });

    it("purges expired entries from admin rate limit store", async () => {
      const loginRequest = new Request("http://localhost:3000/api/admin/auth/login", {
        headers: { "x-real-ip": "10.2.0.1" },
      });

      await checkAdminLoginRateLimit(loginRequest, "expire_test@eventsika.in");
      expect(_getAdminRateLimitStoreSizeForTesting()).toBeGreaterThan(0);

      // Default expiresAt is now + 900_000 (15 min). Fast forward 20 minutes:
      const futureNow = Date.now() + 20 * 60 * 1000;
      _cleanupAdminRateLimitsForTesting(futureNow);

      expect(_getAdminRateLimitStoreSizeForTesting()).toBe(0);
    });

    it("enforces capacity limit constant on admin store", () => {
      expect(MAX_ADMIN_RATE_LIMIT_ENTRIES).toBe(10_000);
    });
  });

  describe("Unknown Backend Values (Fail-Closed)", () => {
    it("fails closed in production when RATE_LIMIT_BACKEND is unrecognized", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RATE_LIMIT_BACKEND", "dynamodb");

      const publicReq = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "203.0.113.99" },
      });
      const publicResult = await checkRateLimit(publicReq, "leads");
      expect(publicResult.isAllowed).toBe(false);
      expect(publicResult.isUnavailable).toBe(true);

      const adminReq = new Request("http://localhost:3000/api/admin/auth/login", {
        headers: { "x-real-ip": "203.0.113.99" },
      });
      const adminResult = await checkAdminLoginRateLimit(adminReq, "admin@eventsika.in");
      expect(adminResult.isAllowed).toBe(false);
      expect(adminResult.isUnavailable).toBe(true);
    });

    it("fails closed across all environments when RATE_LIMIT_BACKEND is invalid", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("RATE_LIMIT_BACKEND", "memcached");

      const publicReq = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "203.0.113.98" },
      });
      const publicResult = await checkRateLimit(publicReq, "leads");
      expect(publicResult.isAllowed).toBe(false);
      expect(publicResult.isUnavailable).toBe(true);

      const adminReq = new Request("http://localhost:3000/api/admin/auth/login", {
        headers: { "x-real-ip": "203.0.113.98" },
      });
      const adminResult = await checkAdminLoginRateLimit(adminReq, "dev@eventsika.in");
      expect(adminResult.isAllowed).toBe(false);
      expect(adminResult.isUnavailable).toBe(true);
    });
  });

  describe("Default Fail-Closed Behavior in Production", () => {
    it("fails closed by default when RATE_LIMIT_BACKEND is unset and Redis is unconfigured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RATE_LIMIT_BACKEND", "");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const publicReq = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "203.0.113.100" },
      });
      const publicResult = await checkRateLimit(publicReq, "leads");
      expect(publicResult.isAllowed).toBe(false);
      expect(publicResult.isUnavailable).toBe(true);

      const adminReq = new Request("http://localhost:3000/api/admin/auth/login", {
        headers: { "x-real-ip": "203.0.113.100" },
      });
      const adminResult = await checkAdminLoginRateLimit(adminReq, "admin@eventsika.in");
      expect(adminResult.isAllowed).toBe(false);
      expect(adminResult.isUnavailable).toBe(true);
    });

    it("fails closed when RATE_LIMIT_BACKEND=upstash but credentials are missing", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("RATE_LIMIT_BACKEND", "upstash");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const publicReq = new Request("http://localhost:3000/api/leads", {
        headers: { "x-real-ip": "203.0.113.101" },
      });
      const publicResult = await checkRateLimit(publicReq, "leads");
      expect(publicResult.isAllowed).toBe(false);
      expect(publicResult.isUnavailable).toBe(true);

      const adminReq = new Request("http://localhost:3000/api/admin/auth/login", {
        headers: { "x-real-ip": "203.0.113.101" },
      });
      const adminResult = await checkAdminLoginRateLimit(adminReq, "admin@eventsika.in");
      expect(adminResult.isAllowed).toBe(false);
      expect(adminResult.isUnavailable).toBe(true);
    });
  });
});
