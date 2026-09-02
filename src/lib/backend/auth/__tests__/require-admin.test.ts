import { describe, it, expect } from "vitest";
import { requireAdminSession } from "../require-admin";
import { User } from "@supabase/supabase-js";

describe("requireAdminSession Authorization Boundary", () => {
  it("returns HTTP 401 unauthorized when no user session exists", async () => {
    const mockClient = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: null,
        }),
      },
    };

    const result = await requireAdminSession(mockClient);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.status).toBe(401);
      expect(result.error).toBe("Authentication required.");
    }
  });

  it("returns HTTP 401 when getUser() encounters a session error", async () => {
    const mockClient = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: new Error("JWT expired"),
        }),
      },
    };

    const result = await requireAdminSession(mockClient);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.status).toBe(401);
    }
  });

  it("returns HTTP 403 when authenticated user has no app_metadata role", async () => {
    const mockUser: Partial<User> = {
      id: "user-normal-123",
      email: "user@example.com",
      app_metadata: {},
      user_metadata: {},
    };

    const mockClient = {
      auth: {
        getUser: async () => ({
          data: { user: mockUser as User },
          error: null,
        }),
      },
    };

    const result = await requireAdminSession(mockClient);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.status).toBe(403);
      expect(result.error).toBe("Administrator privileges required.");
    }
  });

  it("returns HTTP 403 when user injects role into user_metadata (untrusted source)", async () => {
    const mockUser: Partial<User> = {
      id: "user-attacker-123",
      email: "attacker@example.com",
      app_metadata: { role: "client" },
      user_metadata: { role: "admin" }, // Injected untrusted claim
    };

    const mockClient = {
      auth: {
        getUser: async () => ({
          data: { user: mockUser as User },
          error: null,
        }),
      },
    };

    const result = await requireAdminSession(mockClient);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.status).toBe(403);
      expect(result.error).toBe("Administrator privileges required.");
    }
  });

  it("returns HTTP 403 when authenticated user has non-admin role in app_metadata", async () => {
    const mockUser: Partial<User> = {
      id: "user-vendor-123",
      email: "vendor@example.com",
      app_metadata: { role: "vendor" },
    };

    const mockClient = {
      auth: {
        getUser: async () => ({
          data: { user: mockUser as User },
          error: null,
        }),
      },
    };

    const result = await requireAdminSession(mockClient);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.status).toBe(403);
    }
  });

  it("returns authorized true when user possesses verified app_metadata.role === 'admin'", async () => {
    const mockUser: Partial<User> = {
      id: "admin-uuid-456",
      email: "admin@eventsika.in",
      app_metadata: { role: "admin" },
      user_metadata: {},
    };

    const mockClient = {
      auth: {
        getUser: async () => ({
          data: { user: mockUser as User },
          error: null,
        }),
      },
    };

    const result = await requireAdminSession(mockClient);
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.user.id).toBe("admin-uuid-456");
      expect(result.user.email).toBe("admin@eventsika.in");
      expect(result.user.role).toBe("admin");
    }
  });
});
