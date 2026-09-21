import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validatePaymentOrderInput } from "@/lib/backend/validation/payment-order-schema";
import {
  consultationPaymentService,
  PaymentServiceErrorCode,
} from "@/lib/backend/services/consultation-payment-service";
import { logger } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";
import { isAllowedOrigin } from "@/lib/backend/http/origin";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_SIZE = 16384; // 16 KB ceiling

const ERROR_STATUS_MAP: Record<PaymentServiceErrorCode, number> = {
  VALIDATION_ERROR: 400,
  CONSULTATION_NOT_FOUND: 404,
  SLOT_NOT_FOUND: 404,
  INVALID_CONSULTATION_STATUS: 400,
  CONSULTATION_CANCELLED: 400,
  CONSULTATION_ALREADY_CONFIRMED: 409,
  CONSULTATION_HAS_NO_SLOT: 400,
  SLOT_NOT_RESERVED: 409,
  INVALID_RESERVATION_TOKEN: 403,
  RESERVATION_EXPIRED: 410,
  RESERVATION_EXPIRING_SOON: 410,
  PAYMENT_ALREADY_COMPLETED: 409,
  PAYMENT_ORDER_EXPIRED: 410,
  GATEWAY_TIMEOUT: 504,
  GATEWAY_ERROR: 502,
  DATABASE_ERROR: 500,
};

/**
 * POST /api/consultations/payment/order
 *
 * Securely prepares a Cashfree payment order for an existing consultation slot reservation
 * and returns the ephemeral checkout session ID (paymentSessionId).
 *
 * Enforces:
 * - POST-only method
 * - Origin / CSRF validation
 * - 16 KB payload ceiling
 * - IP-based rate limiting (5 req / 10 min)
 * - Authoritative 120s reservation safety threshold
 * - Gateway-First order creation with deterministic order ID
 * - Concurrency resolution via unique constraint
 */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const clientIp = getClientIp(request);

  const baseHeaders: Record<string, string> = {
    "X-Request-Id": requestId,
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  };

  // 1. Origin & Cross-Site Request Guard
  if (!isAllowedOrigin(request)) {
    logger.warn("Payment order creation rejected: Cross-origin request blocked", {
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

  // 2. IP-based Rate Limiting (5 requests per 10 minutes)
  const rateLimit = await checkRateLimit(request, "consultations_payment_order", {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  const responseHeaders: Record<string, string> = {
    ...baseHeaders,
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": rateLimit.remaining.toString(),
  };

  if (rateLimit.isUnavailable) {
    logger.error("Rate limiter datastore unavailable; failing closed for payment order endpoint", {
      requestId,
      clientIp,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Payment service temporarily unavailable. Please try again later.",
      },
      {
        status: 503,
        headers: responseHeaders,
      }
    );
  }

  if (!rateLimit.isAllowed) {
    logger.warn("Rate limit exceeded for payment order creation endpoint", {
      requestId,
      clientIp,
      retryAfter: rateLimit.retryAfterSeconds,
    });

    return NextResponse.json(
      {
        success: false,
        message: "Too many payment order attempts. Please wait a few minutes before trying again.",
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

  // 3. Request Payload Size Guard
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = parseInt(contentLength, 10);
    if (!isNaN(parsedLength) && parsedLength > MAX_PAYLOAD_SIZE) {
      logger.warn("Oversized payment order payload rejected", {
        requestId,
        clientIp,
        contentLength: parsedLength,
      });

      return NextResponse.json(
        {
          success: false,
          message: "Request payload too large. Maximum allowed size is 16 KB.",
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

    // 4. Schema Validation
    const validation = validatePaymentOrderInput(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400, headers: responseHeaders }
      );
    }

    // 5. Business Domain Service Execution
    const result = await consultationPaymentService.createPaymentOrder(validation.data, {
      requestId,
      clientIp,
    });

    if (!result.success) {
      const statusCode = ERROR_STATUS_MAP[result.error] ?? 500;
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          code: result.error,
        },
        {
          status: statusCode,
          headers: responseHeaders,
        }
      );
    }

    // 6. Sanitized Response (Payment Session and Client Mode only, zero secrets or tokens)
    return NextResponse.json(
      {
        success: true,
        data: {
          paymentSessionId: result.data.paymentSessionId,
          environment: result.data.environment,
        },
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    logger.error("Unhandled exception in payment order route handler", error, {
      requestId,
      clientIp,
    });

    return NextResponse.json(
      {
        success: false,
        message: "We encountered an issue preparing your payment order. Please try again.",
      },
      {
        status: 500,
        headers: responseHeaders,
      }
    );
  }
}
