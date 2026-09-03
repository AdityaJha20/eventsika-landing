import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET, PUT, DELETE } from "../logout/route";
import * as serverSupabase from "@/lib/backend/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";

describe("POST /api/admin/auth/logout Endpoint", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-POST HTTP methods with HTTP 405 Method Not Allowed", async () => {
    const getRes = await GET();
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get("Allow")).toBe("POST");

    const putRes = await PUT();
    expect(putRes.status).toBe(405);

    const deleteRes = await DELETE();
    expect(deleteRes.status).toBe(405);
  });

  it("rejects cross-origin logout requests with HTTP 403 Forbidden", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/auth/logout", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil-attacker.com",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("Cross-origin");
  });

  it("calls supabase.auth.signOut() and returns HTTP 200 with confirmation", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });

    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockResolvedValue({
      auth: {
        signOut: mockSignOut,
      },
    } as unknown as SupabaseClient);

    const request = new NextRequest("http://localhost:3000/api/admin/auth/logout", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockSignOut).toHaveBeenCalledTimes(1);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe("Logged out successfully.");
    expect(response.headers.get("x-request-id")).toBeDefined();
  });

  it("handles unexpected errors during logout gracefully returning HTTP 500", async () => {
    vi.spyOn(serverSupabase, "createSupabaseServerClient").mockRejectedValue(
      new Error("Supabase connection fault")
    );

    const request = new NextRequest("http://localhost:3000/api/admin/auth/logout", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Failed to process logout.");
  });
});
