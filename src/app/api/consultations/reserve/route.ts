import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateConsultationInput } from "@/lib/backend/validation/consultation-schema";
import { consultationBookingService } from "@/lib/backend/services/consultation-booking-service";
import { logger } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";
import { isAllowedOrigin } from "@/lib/backend/http/origin";
import { BookingServiceErrorCode } from "@/lib/backend/types/payment-and-consultation";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_SIZE = 51200; // 50 KB ceiling

const ERROR_STATUS_MAP: Record<BookingServiceErrorCode, number> = {
  SLOT_UNAVAILABLE: 409,
  SLOT_PAST_LEAD_TIME: 400,
  INVALID_SLOT: 404,
  VALIDATION_ERROR: 400,
  DATABASE_ERROR: 500,
};

/**
 * POST /api/consultations/reserve
 *
 * Atomically reserves an available consultation slot for 15 minutes
 * and creates a consultation record in 'slot_held' state.
 *
 * Rate Limit: 5 requests per 10 minutes per IP
 */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const clientIp = getClientIp(request);

  const baseHeaders: Record<string, string> = {
    "X-Request-Id": requestId,
    "Cache-Control": "no-store, private",
  };

  // 1. Origin & Cross-Site Request Guard
  if (!isAllowedOrigin(request)) {
    logger.warn("Consultation reservation rejected: Cross-origin request blocked", {
      requestId,
      clientIp,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Cross-origin submission blocked.",
      },
      {
        status: 403,
        headers: baseHeaders,
      }
    );
  }

  // 2. IP-based rate limiting (Max 5 requests per 10 minutes)
  const rateLimit = await checkRateLimit(request, "consultations_reserve", {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  const responseHeaders: Record<string, string> = {
    ...baseHeaders,
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
  };

  if (rateLimit.isUnavailable) {
    logger.error("Rate limiter datastore unavailable; failing closed for reserve endpoint", {
      requestId,
      clientIp,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Reservation service temporarily unavailable. Please try again later.",
      },
      {
        status: 503,
        headers: responseHeaders,
      }
    );
  }

  if (!rateLimit.isAllowed) {
    logger.warn("Rate limit exceeded for consultation reservation endpoint", {
      requestId,
      clientIp,
      retryAfter: rateLimit.retryAfterSeconds,
    });

    return NextResponse.json(
      {
        success: false,
        message: "Too many reservation attempts. Please wait a few minutes before trying again.",
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

  // 3. Request payload size guard
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = parseInt(contentLength, 10);
    if (!isNaN(parsedLength) && parsedLength > MAX_PAYLOAD_SIZE) {
      logger.warn("Oversized reservation payload rejected", {
        requestId,
        clientIp,
        contentLength: parsedLength,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Request payload too large. Maximum allowed size is 50 KB.",
        },
        {
          status: 413,
          headers: responseHeaders,
        }
      );
    }
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request payload format." },
        { status: 400, headers: responseHeaders }
      );
    }

    // 4. Validation & Sanitization Layer
    const validation = validateConsultationInput(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!validation.data.slotId) {
      return NextResponse.json(
        { success: false, message: "Please select an available consultation slot." },
        { status: 400, headers: responseHeaders }
      );
    }

    // 5. Business Service Layer
    const result = await consultationBookingService.reserveSlot(validation.data, {
      requestId,
      clientIp,
    });

    if (!result.success) {
      const statusCode = ERROR_STATUS_MAP[result.error] ?? 500;
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        {
          status: statusCode,
          headers: responseHeaders,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          consultationId: result.consultationId,
          slotId: result.slotId,
          reservationToken: result.reservationToken,
          reservedUntil: result.reservedUntil,
          expiresInSeconds: result.expiresInSeconds,
        },
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    logger.error("Unhandled exception in consultation reserve route handler", error, {
      requestId,
      clientIp,
    });

    return NextResponse.json(
      {
        success: false,
        message: "We encountered an issue reserving your consultation slot. Please try again.",
      },
      {
        status: 500,
        headers: responseHeaders,
      }
    );
  }
}
