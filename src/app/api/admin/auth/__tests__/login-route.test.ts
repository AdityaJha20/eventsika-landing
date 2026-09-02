import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../login/route";
import * as serverSupabase from "@/lib/backend/supabase/server";
import { User, SupabaseClient } from "@supabase/supabase-js";

let ipCounter = 1;
function getUniqueTestIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter}`;
}

function createMockRequest(body: unknown, headersInit?: Record<string, string>): NextRequest {
  const isString = typeof body === "string";
  const rawBody = isString ? body : JSON.stringify(body);
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-for": getUniqueTestIp(),
    ...headersInit,
  });

  return new NextRequest("http://localhost:3000/api/admin/auth/login", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/admin/auth/login Endpoint", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns HTTP 413 if content-length exceeds 50 KB limit", async () => {
    const oversizedHeaders = { "content-length": "60000" };
    const request = createMockRequest({ email: "admin@eventsika.in", password: "password123" }, oversizedHeaders);
    const response = await POST(request);

    expect(response.status).toBe(413);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("size limit");
  });

  it("returns HTTP 400 when body is malformed JSON", async () => {
    const request = createMockRequest("{ invalid-json-payload ");
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Malformed JSON payload.");
  });

  it("returns HTTP 400 when email or password is missing", async () => {
    const request = createMockRequest({ email: "admin@eventsika.in" });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Email and password are required.");
  });

  it("returns HTTP 400 when email format is invalid", async () => {
    const request = createMockRequest({ email: "not-an-email", password: "validPassword123" });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("valid email");
  });

  it("returns HTTP 400 when password is under 6 characters", async () => {
    const request = createMockRequest({ email: "admin@eventsika.in", password: "123" });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("at least 6 characters");
  });

  it("returns HTTP 401 with generic error on invalid Supabase credentials", async () => {
    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null, session: null },
          error: new Error("Invalid login credentials"),
        }),
      },
    } as unknown as SupabaseClient);

    const request = createMockRequest({
      email: "admin@eventsika.in",
      password: "wrongpassword",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Invalid email or password.");
  });

  it("returns HTTP 403 when authenticated user lacks admin app_metadata role", async () => {
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
      password: "password123",
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Administrator privileges required");
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

  it("enforces rate limiting: returns HTTP 429 after 5 requests within the window", async () => {
    const dedicatedRateLimitIp = "198.51.100.250";

    for (let i = 0; i < 5; i++) {
      const req = createMockRequest(
        { email: "invalid", password: "123" },
        { "x-forwarded-for": dedicatedRateLimitIp }
      );
      await POST(req);
    }

    // 6th request must trigger rate limit
    const blockedReq = createMockRequest(
      { email: "admin@eventsika.in", password: "password123" },
      { "x-forwarded-for": dedicatedRateLimitIp }
    );
    const response = await POST(blockedReq);

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Too many login attempts");
    expect(response.headers.get("Retry-After")).toBeDefined();
  });
});
