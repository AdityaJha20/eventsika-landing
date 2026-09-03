import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET, PUT, DELETE } from "../login/route";
import * as serverSupabase from "@/lib/backend/supabase/server";
import {
  _resetAdminRateLimitsForTesting,
  _setAdminRateLimitStoreForTesting,
  UpstashRedisRateLimitStore,
} from "@/lib/rate-limit";
import { Redis } from "@upstash/redis";
import { User, SupabaseClient } from "@supabase/supabase-js";

let ipCounter = 100;
function getUniqueTestIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

function createMockRequest(
  body: unknown,
  headersInit?: Record<string, string>,
  method = "POST"
): NextRequest {
  const isString = typeof body === "string";
  const rawBody = isString ? body : JSON.stringify(body);
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-for": getUniqueTestIp(),
    host: "localhost:3000",
    origin: "http://localhost:3000",
    ...headersInit,
  });

  return new NextRequest("http://localhost:3000/api/admin/auth/login", {
    method,
    headers,
    body: method === "POST" ? rawBody : undefined,
  });
}

describe("POST /api/admin/auth/login Security & Hardening Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetAdminRateLimitsForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetAdminRateLimitsForTesting();
  });

  // --- HTTP Method Guards ---
  it("rejects non-POST HTTP methods with HTTP 405 Method Not Allowed", async () => {
    const getRes = await GET();
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get("Allow")).toBe("POST");

    const putRes = await PUT();
    expect(putRes.status).toBe(405);

    const deleteRes = await DELETE();
    expect(deleteRes.status).toBe(405);
  });

  // --- Origin & CSRF Guards ---
  it("rejects cross-origin requests with HTTP 403 Forbidden", async () => {
    const request = createMockRequest(
      { email: "admin@eventsika.in", password: "password123" },
      { origin: "https://malicious-evilhacker-site.com" }
    );
    const response = await POST(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Cross-origin");
  });

  it("rejects requests with sec-fetch-site: cross-site with HTTP 403 Forbidden", async () => {
    const request = createMockRequest(
      { email: "admin@eventsika.in", password: "password123" },
      { "sec-fetch-site": "cross-site" }
    );
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  // --- Content-Type Guards ---
  it("rejects non-JSON Content-Type with HTTP 415 Unsupported Media Type", async () => {
    const request = createMockRequest(
      "email=admin%40eventsika.in&password=123",
      { "content-type": "application/x-www-form-urlencoded" }
    );
    const response = await POST(request);

    expect(response.status).toBe(415);
    const body = await response.json();
    expect(body.error).toContain("Content-Type must be application/json");
  });

  // --- Payload Size Guards ---
  it("rejects payloads exceeding 8 KB limit with HTTP 413 Payload Too Large", async () => {
    const oversizedHeaders = { "content-length": "9000" };
    const request = createMockRequest(
      { email: "admin@eventsika.in", password: "password123" },
      oversizedHeaders
    );
    const response = await POST(request);

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.error).toContain("size limit (8 KB)");
  });

  // --- Malformed JSON & Malicious Payloads ---
  it("returns HTTP 400 when body is malformed JSON", async () => {
    const request = createMockRequest("{ bad-json: true ");
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Malformed JSON payload.");
  });

  it("returns HTTP 400 when body is an array instead of an object", async () => {
    const request = createMockRequest([{ email: "admin@eventsika.in" }]);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request format.");
  });

  it("rejects prototype pollution attempts with HTTP 400", async () => {
    const request = createMockRequest(
      JSON.parse('{"__proto__": {"admin": true}, "email": "admin@eventsika.in", "password": "password123"}')
    );
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid request format.");
  });

  it("rejects null byte injection in credentials with HTTP 400", async () => {
    const request = createMockRequest({
      email: "admin@eventsika.in\0",
      password: "password123",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid input characters.");
  });

  // --- Input Bounds & Schema Validation ---
  it("returns HTTP 400 when email or password is missing", async () => {
    const request = createMockRequest({ email: "admin@eventsika.in" });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Email and password are required.");
  });

  it("returns HTTP 400 when email format is invalid or exceeds 254 chars", async () => {
    const longEmail = "a".repeat(250) + "@eventsika.in";
    const request = createMockRequest({ email: longEmail, password: "password123" });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("valid email address");
  });

  it("returns HTTP 400 when password is under 6 or exceeds 1024 characters", async () => {
    const shortReq = createMockRequest({ email: "admin@eventsika.in", password: "123" });
    const shortRes = await POST(shortReq);
    expect(shortRes.status).toBe(400);

    const hugePassword = "A".repeat(1025);
    const hugeReq = createMockRequest({ email: "admin@eventsika.in", password: hugePassword });
    const hugeRes = await POST(hugeReq);
    expect(hugeRes.status).toBe(400);
    const body = await hugeRes.json();
    expect(body.error).toContain("between 6 and 1024 characters");
  });

  // --- Authentication & Anti-Enumeration Role Verification ---
  it("returns generic HTTP 401 on invalid credentials to prevent account enumeration", async () => {
    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Invalid login credentials"),
        }),
      },
    } as unknown as SupabaseClient);

    const request = createMockRequest({
      email: "nonexistent@eventsika.in",
      password: "wrongpassword",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid email or password.");
  });

  it("returns identical generic HTTP 401 when non-admin authenticates, eliminating role enumeration", async () => {
    const nonAdminUser: Partial<User> = {
      id: "client-uuid-1",
      email: "client@example.com",
      app_metadata: { role: "client" },
    };

    const mockSignOut = vi.fn().mockResolvedValue({ error: null });

    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: nonAdminUser as User, session: {} },
          error: null,
        }),
        signOut: mockSignOut,
      },
    } as unknown as SupabaseClient);

    const request = createMockRequest({
      email: "client@example.com",
      password: "validClientPassword123",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid email or password.");
  });

  it("returns HTTP 200 when authenticated user has verified app_metadata.role === 'admin'", async () => {
    const adminUser: Partial<User> = {
      id: "admin-uuid-99",
      email: "admin@eventsika.in",
      app_metadata: { role: "admin" },
    };

    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: adminUser as User, session: {} },
          error: null,
        }),
      },
    } as unknown as SupabaseClient);

    const request = createMockRequest({
      email: "admin@eventsika.in",
      password: "SuperSecretAdminPassword123",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Authentication successful.");
    expect(response.headers.get("x-request-id")).toBeDefined();
  });

  // --- Multi-Layer Rate Limiting & Progressive Escalation ---
  it("enforces IP rate limiting: triggers HTTP 429 (15m lock) after 5 failed attempts from same IP", async () => {
    const targetIp = "198.51.100.222";

    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Invalid credentials"),
        }),
      },
    } as unknown as SupabaseClient);

    for (let i = 0; i < 5; i++) {
      const req = createMockRequest(
        { email: `user${i}@eventsika.in`, password: "wrongpassword" },
        { "x-forwarded-for": targetIp }
      );
      const res = await POST(req);
      expect(res.status).toBe(401);
    }

    // 6th attempt from same IP is throttled before touching Supabase
    const blockedReq = createMockRequest(
      { email: "admin@eventsika.in", password: "password123" },
      { "x-forwarded-for": targetIp }
    );
    const blockedRes = await POST(blockedReq);

    expect(blockedRes.status).toBe(429);
    const body = await blockedRes.json();
    expect(body.error).toContain("Too many login attempts");
    const retryAfter = Number(blockedRes.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(900);
  });

  it("enforces Account rate limiting: triggers HTTP 429 after 5 failed attempts against same email even when IP is rotated", async () => {
    const targetAdminEmail = "targeted-admin@eventsika.in";

    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Invalid credentials"),
        }),
      },
    } as unknown as SupabaseClient);

    // Attacker rotates IP for each attempt
    for (let i = 1; i <= 5; i++) {
      const rotatedIp = `198.51.100.${i}`;
      const req = createMockRequest(
        { email: targetAdminEmail, password: "wrongpassword" },
        { "x-forwarded-for": rotatedIp }
      );
      const res = await POST(req);
      expect(res.status).toBe(401);
    }

    // 6th attempt from a brand new IP against the same target account is blocked
    const newIpReq = createMockRequest(
      { email: targetAdminEmail, password: "password123" },
      { "x-forwarded-for": "198.51.100.99" }
    );
    const blockedRes = await POST(newIpReq);

    expect(blockedRes.status).toBe(429);
    const body = await blockedRes.json();
    expect(body.error).toContain("Too many login attempts");
  });

  it("enforces concurrent slot reservation: 10 simultaneous requests from same IP allow max 5 attempts and block the rest with HTTP 429", async () => {
    const concurrentIp = "198.51.100.210";
    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Invalid credentials"),
        }),
      },
    } as unknown as SupabaseClient);

    const promises = [];
    for (let i = 0; i < 10; i++) {
      const req = createMockRequest(
        { email: `concurrent-${i}@eventsika.in`, password: "failedPass123" },
        { "x-forwarded-for": concurrentIp }
      );
      promises.push(POST(req));
    }

    const responses = await Promise.all(promises);
    const statuses = responses.map((r) => r.status);
    const count401 = statuses.filter((s) => s === 401).length;
    const count429 = statuses.filter((s) => s === 429).length;

    expect(count401).toBe(5);
    expect(count429).toBe(5);
  });

  it("demonstrates progressive escalation: 5 fails -> 15m, 10 fails -> 30m, 15+ fails -> 60m", async () => {
    vi.useFakeTimers();
    const testIp = "198.51.100.250";
    const testEmail = "escalation-test@eventsika.in";

    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Invalid credentials"),
        }),
      },
    } as unknown as SupabaseClient);

    // 1. First 5 failures -> triggers Level 1 (15m lock = 900s)
    for (let i = 0; i < 5; i++) {
      const req = createMockRequest({ email: testEmail, password: "failedPass123" }, { "x-forwarded-for": testIp });
      await POST(req);
    }

    const check1 = createMockRequest({ email: testEmail, password: "failedPass123" }, { "x-forwarded-for": testIp });
    const res1 = await POST(check1);
    expect(res1.status).toBe(429);
    expect(Number(res1.headers.get("Retry-After"))).toBeLessThanOrEqual(900);

    // 2. Advance time by 15 minutes + 1 second (cooldown expires, but counter retention is active)
    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

    // Attacker resumes abuse: Failures 6 through 10
    for (let i = 0; i < 5; i++) {
      const req = createMockRequest({ email: testEmail, password: "failedPass123" }, { "x-forwarded-for": testIp });
      await POST(req);
    }

    // 10th failure triggers Level 2 (30m lock = 1800s)
    const check2 = createMockRequest({ email: testEmail, password: "failedPass123" }, { "x-forwarded-for": testIp });
    const res2 = await POST(check2);
    expect(res2.status).toBe(429);
    const retry2 = Number(res2.headers.get("Retry-After"));
    expect(retry2).toBeGreaterThan(900);
    expect(retry2).toBeLessThanOrEqual(1800);

    // 3. Advance time by 30 minutes + 1 second (cooldown 2 expires, counter retention is active)
    vi.advanceTimersByTime(30 * 60 * 1000 + 1000);

    // Attacker resumes abuse: Failures 11 through 15
    for (let i = 0; i < 5; i++) {
      const req = createMockRequest({ email: testEmail, password: "failedPass123" }, { "x-forwarded-for": testIp });
      await POST(req);
    }

    // 15th failure triggers Level 3 (60m lock = 3600s)
    const check3 = createMockRequest({ email: testEmail, password: "failedPass123" }, { "x-forwarded-for": testIp });
    const res3 = await POST(check3);
    expect(res3.status).toBe(429);
    const retry3 = Number(res3.headers.get("Retry-After"));
    expect(retry3).toBeGreaterThan(1800);
    expect(retry3).toBeLessThanOrEqual(3600);
  });

  it("resets failure counter upon successful admin authentication", async () => {
    const adminEmail = "resilient-admin@eventsika.in";
    const testIp = "198.51.100.88";

    // 4 failed attempts
    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Invalid credentials"),
        }),
      },
    } as unknown as SupabaseClient);

    for (let i = 0; i < 4; i++) {
      const req = createMockRequest(
        { email: adminEmail, password: "typoPassword" },
        { "x-forwarded-for": testIp }
      );
      await POST(req);
    }

    // 5th attempt succeeds
    const adminUser: Partial<User> = {
      id: "admin-reset-id",
      email: adminEmail,
      app_metadata: { role: "admin" },
    };

    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: adminUser as User, session: {} },
          error: null,
        }),
      },
    } as unknown as SupabaseClient);

    const successReq = createMockRequest(
      { email: adminEmail, password: "CorrectPassword123" },
      { "x-forwarded-for": testIp }
    );
    const successRes = await POST(successReq);
    expect(successRes.status).toBe(200);

    // Follow-up failed attempt starts from count 1, not blocked
    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Invalid credentials"),
        }),
      },
    } as unknown as SupabaseClient);

    const followUpReq = createMockRequest(
      { email: adminEmail, password: "typoAgain" },
      { "x-forwarded-for": testIp }
    );
    const followUpRes = await POST(followUpReq);
    expect(followUpRes.status).toBe(401);
  });

  // --- Fail-Closed Production Behavior ---
  it("fails closed with HTTP 503 when in production and Redis is unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    try {
      const req = createMockRequest({ email: "admin@eventsika.in", password: "password123" });
      const res = await POST(req);

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("temporarily unavailable");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("fails closed with HTTP 503 when the rate-limit datastore experiences network failure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const faultyStore = {
      checkLimits: vi.fn().mockRejectedValue(new Error("Upstash connection timeout")),
      recordFailure: vi.fn().mockResolvedValue(undefined),
      recordSuccess: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    _setAdminRateLimitStoreForTesting(faultyStore);

    try {
      const req = createMockRequest({ email: "admin@eventsika.in", password: "password123" });
      const res = await POST(req);

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("temporarily unavailable");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  // --- UpstashRedisRateLimitStore Unit Verification ---
  it("UpstashRedisRateLimitStore correctly pipelines TTL checks and executes Lua failure script", async () => {
    const mockExec = vi.fn().mockResolvedValue([[0, 900]]);
    const mockPipeline = {
      ttl: vi.fn(),
      get: vi.fn(),
      eval: vi.fn(),
      exec: mockExec,
    };

    const mockRedis = {
      pipeline: vi.fn(() => mockPipeline),
      get: vi.fn().mockResolvedValue(5),
      del: vi.fn().mockResolvedValue(1),
    };

    const upstashStore = new UpstashRedisRateLimitStore(mockRedis as unknown as Redis);

    // 1. checkLimits when a lock key exists
    const checkResult = await upstashStore.checkLimits("198.51.100.1", "mockhash");
    expect(checkResult.isAllowed).toBe(false);
    expect(checkResult.retryAfterSeconds).toBe(900);
    expect(checkResult.blockedReason).toBe("ip");

    // 2. recordFailure executes pipeline.eval with atomic Lua
    await upstashStore.recordFailure("198.51.100.1", "mockhash");
    expect(mockPipeline.eval).toHaveBeenCalled();

    // 3. recordSuccess calls redis.del
    await upstashStore.recordSuccess("198.51.100.1", "mockhash");
    expect(mockRedis.del).toHaveBeenCalled();
  });
});
