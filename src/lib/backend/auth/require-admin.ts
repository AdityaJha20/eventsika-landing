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

/**
 * Elevated financial authority (refunds, issue resolution, manual reconciliation).
 *
 * Requires an ordinary admin session AND `app_metadata.finance_admin === true`.
 * app_metadata is writable only with the Supabase service role, never by the user,
 * so normal operational admins cannot grant themselves financial authority.
 * There is deliberately no capability here to mark anything as paid.
 */
export async function requireFinanceAdminSession(
  clientOverride?: Parameters<typeof requireAdminSession>[0]
): Promise<AdminAuthResult> {
  const base = await requireAdminSession(clientOverride);
  if (!base.authorized) return base;
  try {
    const client = clientOverride || (await createSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user?.app_metadata?.finance_admin !== true) {
      return { authorized: false, status: 403, error: "Financial administrator privileges required." };
    }
    return base;
  } catch {
    return { authorized: false, status: 401, error: "Authentication session invalid or expired." };
  }
}
