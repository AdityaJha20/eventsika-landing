import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/backend/supabase/server";
import {
  checkAdminLoginRateLimit,
  recordAdminLoginFailure,
  recordAdminLoginSuccess,
} from "@/lib/rate-limit";
import { logger, maskEmail } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";
import { isAllowedOrigin } from "@/lib/backend/http/origin";

const MAX_PAYLOAD_BYTES = 8 * 1024; // 8 KB payload ceiling for auth
const MAX_EMAIL_LENGTH = 254;       // RFC 5321 standard maximum
const MAX_PASSWORD_LENGTH = 1024;   // Prevents computational CPU exhaustion attacks
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_AUTH_ERROR = "Invalid email or password.";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);

  // 1. Origin & CSRF Guard
  if (!isAllowedOrigin(request)) {
    logger.warn("Admin login rejected: Cross-origin request blocked", { requestId });
    return NextResponse.json(
      { success: false, error: "Cross-origin request blocked." },
      { status: 403, headers: { "X-Request-Id": requestId } }
    );
  }

  // 2. Content-Type Guard
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { success: false, error: "Content-Type must be application/json." },
      { status: 415, headers: { "X-Request-Id": requestId } }
    );
  }

  // 3. Payload Size Guard (8 KB ceiling)
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { success: false, error: "Request payload exceeds size limit (8 KB)." },
      { status: 413, headers: { "X-Request-Id": requestId } }
    );
  }

  // 4. Body Parsing & Malicious Input Defense
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Malformed JSON payload." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { success: false, error: "Invalid request format." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  const payload = body as Record<string, unknown>;

  // Prototype pollution defense
  if (
    Object.prototype.hasOwnProperty.call(payload, "__proto__") ||
    Object.prototype.hasOwnProperty.call(payload, "constructor") ||
    Object.prototype.hasOwnProperty.call(payload, "prototype")
  ) {
    return NextResponse.json(
      { success: false, error: "Invalid request format." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  const { email, password } = payload;

  // 5. Strict Server-Side Type & Format Validation
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { success: false, error: "Email and password are required." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  // Null byte injection check
  if (email.includes("\0") || password.includes("\0")) {
    return NextResponse.json(
      { success: false, error: "Invalid input characters." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(cleanEmail)) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid email address." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  if (!password || password.length < 6 || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        success: false,
        error: "Password must be between 6 and 1024 characters.",
      },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  // 6. Multi-Layer Admin Rate Limiting (IP, Account, and Combo with Progressive Cooldown)
  const rateLimitResult = await checkAdminLoginRateLimit(request, cleanEmail);

  if (rateLimitResult.isUnavailable) {
    logger.error("Admin login rate limiter is unavailable in production; failing closed", {
      requestId,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Authentication service temporarily unavailable. Please try again later.",
      },
      { status: 503, headers: { "X-Request-Id": requestId } }
    );
  }

  if (!rateLimitResult.isAllowed) {
    logger.warn("Admin login rate limit exceeded", {
      requestId,
      blockedReason: rateLimitResult.blockedReason,
      retryAfter: rateLimitResult.retryAfterSeconds,
    });
    return NextResponse.json(
      { success: false, error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "X-Request-Id": requestId,
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
        },
      }
    );
  }

  // 7. Supabase Auth Verification & Anti-Enumeration Role Authorization
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.user) {
      await recordAdminLoginFailure(request, cleanEmail);
      logger.warn("Admin login failed: Invalid credentials", {
        requestId,
        email: maskEmail(cleanEmail),
      });
      // Unified generic response to eliminate account enumeration
      return NextResponse.json(
        { success: false, error: GENERIC_AUTH_ERROR },
        { status: 401, headers: { "X-Request-Id": requestId } }
      );
    }

    // 8. Authoritative Role Verification on Protected Server app_metadata
    const role = data.user.app_metadata?.role;
    if (role !== "admin") {
      // Non-admin user signed in: immediately terminate session and apply failed-attempt tracking
      await supabase.auth.signOut();
      await recordAdminLoginFailure(request, cleanEmail);
      logger.warn("Admin login rejected: Non-admin user", {
        requestId,
        userId: data.user.id,
      });
      // Unified generic response to eliminate role/privilege enumeration
      return NextResponse.json(
        { success: false, error: GENERIC_AUTH_ERROR },
        { status: 401, headers: { "X-Request-Id": requestId } }
      );
    }

    // 9. Verified Admin: Reset Failure Counters & Complete Session Handshake
    await recordAdminLoginSuccess(request, cleanEmail);

    logger.info("Admin login successful", {
      requestId,
      userId: data.user.id,
      email: maskEmail(cleanEmail),
    });

    return NextResponse.json(
      { success: true, message: "Authentication successful." },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );
  } catch (error) {
    logger.error("Unexpected error during admin login", error, { requestId });
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500, headers: { "X-Request-Id": requestId } }
    );
  }
}

export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function PUT() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function PATCH() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
