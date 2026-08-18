/**
 * Lightweight In-Memory Sliding/Fixed Window Rate Limiter
 *
 * Designed for Next.js Route Handlers (Edge / Node.js Serverless).
 *
 * NOTE ON SERVERLESS / VERCEL:
 * In-memory storage is per server instance. In distributed/serverless environments,
 * multiple isolated function instances maintain their own separate memory state.
 * This provides practical best-effort burst/abuse mitigation without external
 * dependencies (Redis/Upstash).
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store keyed by `${namespace}:${clientIp}`
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically (every 5 minutes)
let lastCleanup = Date.now();
function cleanupStaleRecords(now: number) {
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [key, record] of rateLimitStore.entries()) {
    if (now >= record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Safely extracts client IP address from standard Next.js / Vercel headers.
 *
 * Header Priority:
 * 1. x-real-ip (Standard reverse proxy header set by Vercel/Cloudflare)
 * 2. x-forwarded-for (Takes the first untampered public IP in chain)
 * 3. fallback to "127.0.0.1" (Local dev / testing)
 */
export function getClientIp(request: Request): string {
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp && xRealIp.trim() !== "") {
    return xRealIp.trim().split(",")[0].trim();
  }

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor && xForwardedFor.trim() !== "") {
    // First IP in list is original client IP
    const firstIp = xForwardedFor.split(",")[0].trim();
    if (firstIp) return firstIp;
  }

  return "127.0.0.1";
}

export interface RateLimitOptions {
  limit?: number; // Maximum allowed requests within window (default: 5)
  windowMs?: number; // Time window in milliseconds (default: 10 minutes)
}

export interface RateLimitResult {
  isAllowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
}

/**
 * Evaluates rate limit for a given request and endpoint namespace.
 */
export function checkRateLimit(
  request: Request,
  namespace: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 10 * 60 * 1000; // 10 minutes

  const clientIp = getClientIp(request);
  const key = `${namespace}:${clientIp}`;
  const now = Date.now();

  cleanupStaleRecords(now);

  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetTime) {
    // New window
    const resetTime = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      isAllowed: true,
      remaining: limit - 1,
      resetTime,
      retryAfterSeconds: 0,
    };
  }

  if (record.count < limit) {
    record.count += 1;
    return {
      isAllowed: true,
      remaining: limit - record.count,
      resetTime: record.resetTime,
      retryAfterSeconds: 0,
    };
  }

  // Limit exceeded
  const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
  return {
    isAllowed: false,
    remaining: 0,
    resetTime: record.resetTime,
    retryAfterSeconds,
  };
}
