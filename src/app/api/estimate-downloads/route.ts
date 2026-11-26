import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateEstimateDownloadInput } from "@/lib/backend/validation/estimate-download-schema";
import {
  EstimateDownloadKeyConflictError,
  EstimateDownloadStorageError,
  saveEstimateDownloadLead,
} from "@/lib/backend/repositories/supabase-estimate-download-repository";
import { getSupabaseAdminClient } from "@/lib/backend/supabase/client";
import { logger } from "@/lib/backend/logger/logger";
import { getOrCreateRequestId } from "@/lib/backend/utils/request-id";
import { isAllowedOrigin } from "@/lib/backend/http/origin";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_SIZE = 4096; // the payload is a handful of short fields
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const SAVE_FAILED_MESSAGE =
  "We couldn't save your details just now, so the PDF wasn't downloaded. Please try again.";

/**
 * Stores the contact (with consent) and server-priced estimate given before an
 * estimate PDF download. Logs carry the request ID only: never the contact,
 * the client IP or a database error message.
 */
export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const baseHeaders = { "X-Request-Id": requestId };
  const json = (status: number, body: Record<string, unknown>, headers: Record<string, string> = baseHeaders) =>
    NextResponse.json(body, { status, headers });

  if (!isAllowedOrigin(request)) {
    logger.warn("Estimate download capture rejected: cross-origin request", { requestId });
    return json(403, { success: false, message: "Cross-origin submission blocked." });
  }

  const rateLimit = await checkRateLimit(request, "estimate_downloads", {
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (rateLimit.isUnavailable) {
    logger.error("Rate limiter unavailable; failing closed for estimate downloads", undefined, { requestId });
    return json(503, {
      success: false,
      message: "This service is temporarily unavailable. Please try again later.",
    });
  }
  const headers = {
    ...baseHeaders,
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  };
  if (!rateLimit.isAllowed) {
    logger.warn("Rate limit exceeded for estimate downloads", { requestId });
    return json(
      429,
      { success: false, message: "Too many attempts. Please wait a few minutes and try again." },
      { ...headers, "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_PAYLOAD_SIZE) {
    return json(413, { success: false, message: "Request payload too large." }, headers);
  }

  const text = await request.text().catch(() => null);
  if (text === null || text.length > MAX_PAYLOAD_SIZE) {
    return json(413, { success: false, message: "Request payload too large." }, headers);
  }
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // handled below
  }

  const validation = validateEstimateDownloadInput(body);
  if (!validation.success) {
    return json(400, { success: false, message: validation.error }, headers);
  }

  // No in-memory fallback: a capture that is not persisted is reported as a failure.
  const client = getSupabaseAdminClient();
  if (!client) {
    logger.error("Estimate download capture unavailable: Supabase is not configured", undefined, { requestId });
    return json(503, { success: false, message: SAVE_FAILED_MESSAGE }, headers);
  }

  try {
    const saved = await saveEstimateDownloadLead(client, validation.data, new Date());
    logger.info("Estimate download lead stored", {
      requestId,
      captureId: saved.id,
      duplicate: saved.duplicate,
      contactType: validation.data.contactType,
      packageTier: validation.data.packageTier,
    });
    return json(saved.duplicate ? 200 : 201, { success: true, captureId: saved.id }, headers);
  } catch (error) {
    if (error instanceof EstimateDownloadKeyConflictError) {
      logger.warn("Estimate download idempotency key reused with different data", { requestId });
      return json(409, { success: false, message: "Please reload the page and try again." }, headers);
    }
    logger.error("Estimate download lead could not be stored", undefined, {
      requestId,
      code: error instanceof EstimateDownloadStorageError ? error.code : "unexpected",
    });
    return json(500, { success: false, message: SAVE_FAILED_MESSAGE }, headers);
  }
}
