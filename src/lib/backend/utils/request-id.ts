import { NextRequest } from "next/server";

/**
 * Extracts an incoming request ID or generates a new compact correlation ID.
 */
export function getOrCreateRequestId(request?: NextRequest): string {
  if (request) {
    const existing = request.headers.get("x-request-id");
    if (existing && existing.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(existing)) {
      return existing;
    }
  }

  // Generate safe 12-char unique correlation identifier
  const timestamp = Date.now().toString(36);
  const randomSuffix = crypto.randomUUID().split("-")[0].slice(0, 6);
  return `req_${timestamp}_${randomSuffix}`;
}
