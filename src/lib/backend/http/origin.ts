import { NextRequest } from "next/server";

/**
 * Shared Origin & Cross-Site Request Verification Utility
 *
 * Security Purpose & Threat Model:
 * 1. Origin verification protects against browser-based cross-site request attacks:
 *    - Login CSRF / Session Fixation on authentication routes.
 *    - Cross-site automated form injection / spamming from third-party websites.
 * 2. IMPORTANT ARCHITECTURAL SEMANTICS:
 *    - Origin verification is NOT authentication, nor is it a defense against direct
 *      server-to-server or non-browser abuse (e.g. automated scripts or curl which can omit
 *      or forge headers).
 *    - Defense against non-browser abuse is authoritatively enforced by the downstream layers:
 *      payload size ceilings, strict schema allowlists, honeypot traps, sliding-window
 *      deduplication, and distributed rate limiting.
 * 3. Browser vs Non-Browser Client Semantics:
 *    - Browser clients emitting `Sec-Fetch-Site: cross-site` are blocked immediately.
 *    - Browser clients emitting `Origin` are verified strictly against the request `Host`.
 *    - If `Origin` is absent but `Referer` is present, `Referer` host is checked against `Host`.
 *    - Non-browser clients / server-to-server integrations where both `Origin` and `Sec-Fetch-Site`
 *      are absent are permitted through to allow health probes and valid automated tooling.
 */
export function isAllowedOrigin(request: NextRequest | Request): boolean {
  const headers = request.headers;

  // 1. Sec-Fetch-Site signal: Immediately reject cross-site browser requests
  const secFetchSite = headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return false;
  }

  // 2. Extract target Host
  const host =
    headers.get("host") ||
    ("nextUrl" in request ? (request as NextRequest).nextUrl?.host : null);

  if (!host) {
    return false;
  }

  const normalizedHost = host.toLowerCase();

  // 3. Inspect Origin header (Primary browser signal for POST/PUT/DELETE)
  const origin = headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      return originUrl.host.toLowerCase() === normalizedHost;
    } catch {
      // Malformed Origin header
      return false;
    }
  }

  // 4. Fallback inspection of Referer header if Origin is absent
  const referer = headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.host.toLowerCase() === normalizedHost;
    } catch {
      return false;
    }
  }

  // 5. Permitted non-browser / server-to-server client (Origin and Sec-Fetch-Site both absent)
  return true;
}
