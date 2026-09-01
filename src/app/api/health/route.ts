import { NextRequest, NextResponse } from "next/server";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);

  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    },
    {
      status: 200,
      headers: {
        "X-Request-Id": requestId,
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
