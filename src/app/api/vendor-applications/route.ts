import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateVendorInput } from "@/lib/backend/validation/vendor-schema";
import { vendorService } from "@/lib/backend/services/vendor-service";
import { logger } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_SIZE = 51200; // 50 KB ceiling

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const clientIp = getClientIp(request);

  // 1. IP-based rate limiting (Max 5 requests per 10 minutes)
  const rateLimit = checkRateLimit(request, "vendor_applications", {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  const responseHeaders = {
    "X-Request-Id": requestId,
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
  };

  if (!rateLimit.isAllowed) {
    logger.warn("Rate limit exceeded for vendor applications endpoint", {
      requestId,
      clientIp,
      retryAfter: rateLimit.retryAfterSeconds,
    });

    return NextResponse.json(
      {
        success: false,
        message: "Too many submission attempts. Please wait a few minutes before trying again.",
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

  // 2. Request payload size guard
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = parseInt(contentLength, 10);
    if (!isNaN(parsedLength) && parsedLength > MAX_PAYLOAD_SIZE) {
      logger.warn("Oversized vendor application payload rejected", {
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

    // 3. Validation & Sanitization Layer
    const validation = validateVendorInput(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400, headers: responseHeaders }
      );
    }

    // 4. Business Service Layer
    const result = await vendorService.processVendorApplication(validation.data, {
      requestId,
      clientIp,
    });

    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    logger.error("Unhandled exception in vendor applications route handler", error, {
      requestId,
      clientIp,
    });

    return NextResponse.json(
      {
        success: false,
        message: "We encountered an issue submitting your application. Please try again or reach out to care@eventsika.in.",
      },
      {
        status: 500,
        headers: responseHeaders,
      }
    );
  }
}
