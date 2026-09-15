import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { consultationBookingService } from "@/lib/backend/services/consultation-booking-service";
import { logger } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";
import { isAllowedOrigin } from "@/lib/backend/http/origin";

export const dynamic = "force-dynamic";

/**
 * GET /api/consultations/slots
 *
 * Public endpoint to fetch available consultation slots.
 * Server-authoritatively calculates and materializes slots within the rolling window.
 *
 * Rate Limit: 30 requests per minute per IP
 * Cache-Control: no-store, private (MANDATORY)
 */
export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const clientIp = getClientIp(request);

  // Mandatory cache-control header to prevent browser/CDN caching of dynamic slot inventory
  const baseHeaders: Record<string, string> = {
    "X-Request-Id": requestId,
    "Cache-Control": "no-store, private",
  };

  // 1. Origin & Cross-Site Request Guard
  if (!isAllowedOrigin(request)) {
    logger.warn("Consultation slots query rejected: Cross-origin request blocked", {
      requestId,
      clientIp,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Cross-origin request blocked.",
      },
      {
        status: 403,
        headers: baseHeaders,
      }
    );
  }

  // 2. Rate limiting: Max 30 requests per minute per IP
  const rateLimit = await checkRateLimit(request, "consultations_slots", {
    limit: 30,
    windowMs: 60 * 1000,
  });

  const responseHeaders: Record<string, string> = {
    ...baseHeaders,
    "X-RateLimit-Limit": "30",
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
  };

  if (rateLimit.isUnavailable) {
    logger.error("Rate limiter datastore unavailable; failing closed for consultation slots endpoint", {
      requestId,
      clientIp,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Slot availability service temporarily unavailable. Please try again later.",
      },
      {
        status: 503,
        headers: responseHeaders,
      }
    );
  }

  if (!rateLimit.isAllowed) {
    logger.warn("Rate limit exceeded for consultation slots endpoint", {
      requestId,
      clientIp,
      retryAfter: rateLimit.retryAfterSeconds,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Too many slot availability queries. Please wait before trying again.",
      },
      {
        status: 429,
        headers: {
          ...responseHeaders,
          "Retry-After": rateLimit.retryAfterSeconds.toString(),
        },
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;

    const availableSlots = await consultationBookingService.getAvailableSlots({
      startDate,
      endDate,
    });

    // Public DTO mapping: id, startTime, endTime only.
    // Zero internal metadata, reservation tokens, or customer info leaked.
    const slots = availableSlots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          slots,
        },
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    // If client supplied malformed date string (e.g. invalid date format), return HTTP 400
    if (
      error instanceof Error &&
      (error.message.includes("Invalid startDate") ||
        error.message.includes("Invalid endDate") ||
        error.message.includes("must not be after"))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        {
          status: 400,
          headers: responseHeaders,
        }
      );
    }

    logger.error("Unhandled exception in consultation slots route handler", error, {
      requestId,
      clientIp,
    });

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve available slots. Please try again later.",
      },
      {
        status: 500,
        headers: responseHeaders,
      }
    );
  }
}
