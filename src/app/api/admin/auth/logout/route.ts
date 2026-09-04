import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/backend/supabase/server";
import { logger } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";
import { isAllowedOrigin } from "@/lib/backend/http/origin";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);

  if (!isAllowedOrigin(request)) {
    logger.warn("Admin logout rejected: Cross-origin request blocked", { requestId });
    return NextResponse.json(
      { success: false, error: "Cross-origin request blocked." },
      { status: 403, headers: { "X-Request-Id": requestId } }
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    logger.info("Admin logout executed", { requestId });

    return NextResponse.json(
      { success: true, message: "Logged out successfully." },
      { status: 200, headers: { "X-Request-Id": requestId } }
    );
  } catch (error) {
    logger.error("Error during admin logout", error, { requestId });
    return NextResponse.json(
      { success: false, error: "Failed to process logout." },
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
