import { createSupabaseServerClient } from "../supabase/server";
import { User, SupabaseClient } from "@supabase/supabase-js";

export interface AdminUser {
  id: string;
  email?: string;
  role: "admin";
}

export type AdminAuthResult =
  | {
      authorized: true;
      user: AdminUser;
    }
  | {
      authorized: false;
      status: 401 | 403;
      error: string;
    };

/**
 * Authoritative Server-Side Authorization Boundary.
 *
 * Verifies that the active request possesses a valid authenticated session
 * and that the user's role in app_metadata is strictly "admin".
 *
 * Security Invariants:
 * - Strictly checks `user.app_metadata?.role === "admin"`.
 * - Never trusts `user_metadata`, request body, client headers, or cookies for role determination.
 * - Returns HTTP 401 for unauthenticated requests.
 * - Returns HTTP 403 for authenticated non-admin requests.
 */
export async function requireAdminSession(
  clientOverride?: SupabaseClient | { auth: { getUser: () => Promise<{ data: { user: User | null }; error: unknown }> } }
): Promise<AdminAuthResult> {
  try {
    const client = clientOverride || (await createSupabaseServerClient());
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      return {
        authorized: false,
        status: 401,
        error: "Authentication required.",
      };
    }

    // Authoritative check on protected server-only metadata
    const role = user.app_metadata?.role;
    if (role !== "admin") {
      return {
        authorized: false,
        status: 403,
        error: "Administrator privileges required.",
      };
    }

    return {
      authorized: true,
      user: {
        id: user.id,
        email: user.email,
        role: "admin",
      },
    };
  } catch {
    return {
      authorized: false,
      status: 401,
      error: "Authentication session invalid or expired.",
    };
  }
}
