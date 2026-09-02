import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/backend/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger, maskEmail } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";

const MAX_PAYLOAD_BYTES = 50 * 1024; // 50 KB max
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);

  // 1. Payload Size Guard
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { success: false, error: "Request payload exceeds size limit (50 KB)." },
      { status: 413, headers: { "X-Request-Id": requestId } }
    );
  }

  // 2. IP Rate Limiting (5 requests / 15 minutes window)
  const rateLimitResult = checkRateLimit(request, "admin_login", {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimitResult.isAllowed) {
    logger.warn("Admin login rate limit exceeded", { requestId });
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

  // 3. Body Parsing & Safe Extraction
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Malformed JSON payload." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { success: false, error: "Invalid request format." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  const { email, password } = body as Record<string, unknown>;

  // 4. Strict Server-Side Validation
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { success: false, error: "Email and password are required." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid email address." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { success: false, error: "Password must be at least 6 characters." },
      { status: 400, headers: { "X-Request-Id": requestId } }
    );
  }

  // 5. Supabase Auth Verification
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.user) {
      logger.warn("Admin login failed: Invalid credentials", {
        requestId,
        email: maskEmail(cleanEmail),
      });
      // Generic error response to prevent account enumeration
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401, headers: { "X-Request-Id": requestId } }
      );
    }

    // 6. Authoritative Role Verification
    const role = data.user.app_metadata?.role;
    if (role !== "admin") {
      logger.warn("Admin login rejected: Non-admin user", {
        requestId,
        userId: data.user.id,
      });
      // Invalidate session immediately for non-admin attempts
      await supabase.auth.signOut();
      return NextResponse.json(
        { success: false, error: "Access denied: Administrator privileges required." },
        { status: 403, headers: { "X-Request-Id": requestId } }
      );
    }

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
