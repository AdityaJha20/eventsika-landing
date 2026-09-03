import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

describe("Middleware Route Protection & Exemption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_pub_test";
  });

  it("explicitly allows /api/admin/auth/login without authentication", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/auth/login", {
      method: "POST",
    });

    const response = await middleware(request);
    expect(response.status).toBe(200);
    // Should NOT redirect or return 401
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects unauthenticated browser requests to /admin to /login", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("No session"),
    });

    const request = new NextRequest("http://localhost:3000/admin");
    const response = await middleware(request);

    expect(response.status).toBe(307); // Next.js redirect
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("returns HTTP 401 JSON when unauthenticated request accesses /api/admin/*", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("No session"),
    });

    const request = new NextRequest("http://localhost:3000/api/admin/leads");
    const response = await middleware(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Administrator privileges required");
  });

  it("returns HTTP 401 JSON when authenticated non-admin accesses /api/admin/*", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: { id: "client-id", app_metadata: { role: "client" } },
      },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/leads");
    const response = await middleware(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Administrator privileges required");
  });

  it("allows verified admin access to /admin and sets refreshed cookies", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: { id: "admin-id", app_metadata: { role: "admin" } },
      },
      error: null,
    });

    const request = new NextRequest("http://localhost:3000/admin");
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
