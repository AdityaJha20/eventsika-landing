import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/backend/supabase/server";
import { logger } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);

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
