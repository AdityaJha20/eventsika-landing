/**
 * Shared guard for public, customer-facing JSON POST routes (payment verify /
 * status / rebook): origin check, IP rate limit (fails closed if the limiter is
 * down), byte-capped body read (does not trust Content-Length), JSON parsing.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isAllowedOrigin } from "./origin";
import { getOrCreateRequestId } from "../utils/request-id";
import { logger } from "../logger/logger";

export interface GuardOptions {
  bucket: string;
  limit: number;
  windowMs: number;
  maxBytes: number;
}

export type GuardResult =
  | { ok: true; body: Record<string, unknown>; requestId: string; headers: Record<string, string>; clientIp: string }
  | { ok: false; response: NextResponse };

export async function guardPublicJsonPost(request: NextRequest, options: GuardOptions): Promise<GuardResult> {
  const requestId = getOrCreateRequestId(request);
  const clientIp = getClientIp(request);
  const headers: Record<string, string> = {
    "X-Request-Id": requestId,
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  };
  const fail = (status: number, message: string, extra?: Record<string, string>) => ({
    ok: false as const,
    response: NextResponse.json({ success: false, message }, { status, headers: { ...headers, ...extra } }),
  });

  if (!isAllowedOrigin(request)) {
    logger.warn("Cross-origin request blocked", { requestId, bucket: options.bucket });
    return fail(403, "Cross-origin submission blocked.");
  }

  const rate = await checkRateLimit(request, options.bucket, { limit: options.limit, windowMs: options.windowMs });
  if (rate.isUnavailable) {
    logger.error("Rate limiter unavailable; failing closed", undefined, { requestId, bucket: options.bucket });
    return fail(503, "Service temporarily unavailable. Please try again shortly.");
  }
  if (!rate.isAllowed) {
    return fail(429, "Too many requests. Please wait a moment and try again.", {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > options.maxBytes) {
    return fail(413, "Request payload too large.");
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return fail(400, "Unable to read request body.");
  }
  if (Buffer.byteLength(raw, "utf8") > options.maxBytes) {
    return fail(413, "Request payload too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Invalid request payload format.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail(400, "Invalid request payload format.");
  }

  return { ok: true, body: body as Record<string, unknown>, requestId, headers, clientIp };
}
