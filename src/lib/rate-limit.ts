/**
 * Distributed & In-Memory Rate Limiting Architecture
 *
 * Provides:
 * 1. Fixed/sliding window rate limiter for public route handlers (leads, vendors).
 * 2. Multi-layer, distributed failed-attempt rate limiter for admin login:
 *    - Layer 1: Client IP address
 *    - Layer 2: Targeted account (SHA-256 hashed normalized email)
 *    - Layer 3: Combined (IP + Account)
 *    - Atomic pre-check slot reservation: prevents concurrent simultaneous requests from bypassing limits.
 *    - Tier-based progressive cooldown: Tier 1 (5 fails -> 15m), Tier 2 (10 fails -> 30m), Tier 3 (15+ fails -> 60m).
 *    - Extended observation retention (cooldown + 15m) ensuring escalation tiers are reachable.
 *    - Atomic Redis Lua script execution preventing race conditions.
 *    - Mandatory finite TTLs on all keys; zero unbounded state or memory exhaustion.
 *    - Fail-closed security guarantee in production.
 *    - Convenient in-memory fallback in development/testing.
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import { logger } from "@/lib/backend/logger/logger";

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory store for general API routes (leads, vendor applications)
const rateLimitStore = new Map<string, RateLimitRecord>();

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

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

/**
 * Validates whether a candidate string is a syntactically valid IPv4 or IPv6 address.
 */
export function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

/**
 * Safely extracts client IP address from request socket or trusted reverse-proxy headers.
 *
 * PRODUCTION INGRESS TRUST ARCHITECTURE & SECURITY ASSUMPTIONS:
 * 1. Reverse-Proxy Header Trust Model:
 *    - This function inspects headers emitted by edge proxies: `cf-connecting-ip` (Cloudflare),
 *      `x-real-ip` (Nginx/Hostinger proxy), and `x-forwarded-for`.
 *    - Application-layer code CANNOT cryptographically distinguish between a genuine header
 *      added by a trusted reverse proxy and a spoofed header injected by a client IF the
 *      application server is exposed directly to the public internet without an ingress filter.
 * 2. Mandatory Production Requirement:
 *    - In production deployments (e.g. Hostinger VPS, Cloudflare edge, Docker container),
 *      the perimeter reverse proxy (Cloudflare / Nginx / Hostinger gateway) MUST be configured
 *      to OVERWRITE or STRIP any client-supplied `X-Forwarded-For` or `CF-Connecting-IP` headers
 *      before proxying traffic to the Next.js Node process.
 * 3. Fallback:
 *    - If no valid IP is discovered, safely defaults to "127.0.0.1".
 */
export function getClientIp(request: Request): string {
  const socketIp = (request as unknown as { ip?: string }).ip;
  if (socketIp && isValidIp(socketIp.trim())) {
    return socketIp.trim();
  }

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    const candidate = cfIp.trim().split(",")[0].trim();
    if (isValidIp(candidate)) return candidate;
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    const candidate = xRealIp.trim().split(",")[0].trim();
    if (isValidIp(candidate)) return candidate;
  }

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const candidates = xForwardedFor.split(",").map((p) => p.trim());
    for (const candidate of candidates) {
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
  }

  return "127.0.0.1";
}

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

export interface RateLimitResult {
  isAllowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
  isUnavailable?: boolean;
}

/**
 * In-memory fallback rate limiter for general API routes (used in development & test).
 */
function checkRateLimitInMemory(
  clientIp: string,
  namespace: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const key = `${namespace}:${clientIp}`;
  const now = Date.now();

  cleanupStaleRecords(now);

  const record = rateLimitStore.get(key);

  if (!record || now >= record.resetTime) {
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

  const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
  return {
    isAllowed: false,
    remaining: 0,
    resetTime: record.resetTime,
    retryAfterSeconds,
  };
}

/**
 * Distributed & in-memory rate limiter for general API routes (leads, vendor applications).
 *
 * Production:
 * - Uses Upstash Redis with atomic Lua script and bounded key TTLs.
 * - Fails closed (isUnavailable: true) if Redis is unavailable, maintaining the rate-limit
 *   security boundary consistently with admin authentication.
 *
 * Development / Test:
 * - Uses in-memory Map store for offline zero-dependency development and testing.
 */
export async function checkRateLimit(
  request: Request,
  namespace: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 10 * 60 * 1000;
  const windowSeconds = Math.ceil(windowMs / 1000);
  const clientIp = getClientIp(request);
  const isProduction = process.env.NODE_ENV === "production";

  const { store, isUnavailable } = getAdminRateLimitStore();

  if (isProduction && (isUnavailable || !store)) {
    return {
      isAllowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      retryAfterSeconds: 60,
      isUnavailable: true,
    };
  }

  if (store instanceof UpstashRedisRateLimitStore) {
    try {
      return await store.checkNamespaceLimit(clientIp, namespace, limit, windowSeconds);
    } catch (err) {
      logger.error("Public rate limiter Redis check failed", err);
      if (isProduction) {
        return {
          isAllowed: false,
          remaining: 0,
          resetTime: Date.now() + 60_000,
          retryAfterSeconds: 60,
          isUnavailable: true,
        };
      }
    }
  }

  return checkRateLimitInMemory(clientIp, namespace, limit, windowMs);
}

/* ==========================================================================
   Admin Authentication Multi-Layer Distributed Rate Limiter
   ========================================================================== */

export interface AdminRateLimitResult {
  isAllowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  blockedReason?: "ip" | "account" | "combo";
  isUnavailable?: boolean;
}

export interface IAdminRateLimitStore {
  checkLimits(ip: string, emailHash?: string): Promise<AdminRateLimitResult>;
  recordFailure(ip: string, emailHash?: string): Promise<void>;
  recordSuccess(ip: string, emailHash?: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Generates fixed-length SHA-256 hash for email to prevent arbitrary-length memory bloat.
 */
export function hashEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Atomic Lua Script for Check & Slot Reservation:
 * KEYS[1]: countKey
 * KEYS[2]: lockKey
 * KEYS[3]: tierKey
 * ARGV[1]: baseWindowSeconds (900)
 */
const CHECK_LIMIT_LUA = `
local lockTtl = redis.call('TTL', KEYS[2])
if lockTtl > 0 then
    return { 0, lockTtl }
end

local tier = tonumber(redis.call('GET', KEYS[3]) or '1')
local allowedLimit = tier * 5

local curCount = tonumber(redis.call('GET', KEYS[1]) or '0')

if curCount >= allowedLimit then
    local cooldown = 900
    if tier >= 3 then
        cooldown = 3600
    elseif tier == 2 then
        cooldown = 1800
    end
    redis.call('SET', KEYS[2], curCount, 'EX', cooldown)
    local nextTier = math.min(3, tier + 1)
    local retentionTtl = cooldown + tonumber(ARGV[1])
    redis.call('SET', KEYS[3], nextTier, 'EX', retentionTtl)
    redis.call('EXPIRE', KEYS[1], retentionTtl)
    return { 0, cooldown }
end

local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end

local tierTtl = redis.call('TTL', KEYS[3])
if tierTtl < 0 then
    redis.call('EXPIRE', KEYS[3], tonumber(ARGV[1]))
end

return { 1, 0, allowedLimit - count }
`;

/**
 * Atomic Lua Script for Recording Post-Authentication Failure:
 * Locks on tier boundary (5, 10, 15) and sets next escalation tier.
 */
const RECORD_FAILURE_LUA = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
local tier = tonumber(redis.call('GET', KEYS[3]) or '1')

if count >= (tier * 5) then
    local cooldown = 900
    if tier >= 3 then
        cooldown = 3600
    elseif tier == 2 then
        cooldown = 1800
    end
    redis.call('SET', KEYS[2], count, 'EX', cooldown)
    local nextTier = math.min(3, tier + 1)
    local retentionTtl = cooldown + tonumber(ARGV[1])
    redis.call('SET', KEYS[3], nextTier, 'EX', retentionTtl)
    redis.call('EXPIRE', KEYS[1], retentionTtl)
    return { count, cooldown }
end

return { count, 0 }
`;

/**
 * Atomic Lua Script for Public Endpoints Fixed-Window Rate Limiting:
 * KEYS[1]: rate limit key (e.g. eventsika:rate:leads:192.0.2.1)
 * ARGV[1]: windowSeconds (TTL)
 */
const PUBLIC_RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
    ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

/**
 * Distributed Upstash Redis Rate Limit Store.
 */
export class UpstashRedisRateLimitStore implements IAdminRateLimitStore {
  private redis: Redis;

  constructor(redisClient?: Redis) {
    if (redisClient) {
      this.redis = redisClient;
    } else {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (!url || !token) {
        throw new Error("Missing Upstash Redis environment variables");
      }
      this.redis = new Redis({ url, token });
    }
  }

  async checkLimits(ip: string, emailHash?: string): Promise<AdminRateLimitResult> {
    const dimensions: { countKey: string; lockKey: string; tierKey: string; reason: "ip" | "account" | "combo" }[] = [
      {
        countKey: `eventsika:admin:count:ip:${ip}`,
        lockKey: `eventsika:admin:lock:ip:${ip}`,
        tierKey: `eventsika:admin:tier:ip:${ip}`,
        reason: "ip",
      },
    ];
    if (emailHash) {
      dimensions.push(
        {
          countKey: `eventsika:admin:count:acc:${emailHash}`,
          lockKey: `eventsika:admin:lock:acc:${emailHash}`,
          tierKey: `eventsika:admin:tier:acc:${emailHash}`,
          reason: "account",
        },
        {
          countKey: `eventsika:admin:count:combo:${ip}:${emailHash}`,
          lockKey: `eventsika:admin:lock:combo:${ip}:${emailHash}`,
          tierKey: `eventsika:admin:tier:combo:${ip}:${emailHash}`,
          reason: "combo",
        }
      );
    }

    // Execute atomic reservation Lua script across all dimensions in parallel pipeline
    const pipeline = this.redis.pipeline();
    for (const { countKey, lockKey, tierKey } of dimensions) {
      pipeline.eval(CHECK_LIMIT_LUA, [countKey, lockKey, tierKey], [900]);
    }

    const results = (await pipeline.exec()) as [number, number, number?][];

    for (let i = 0; i < dimensions.length; i++) {
      const res = results[i];
      const allowed = Array.isArray(res) ? res[0] : 1;
      const retryAfter = Array.isArray(res) ? res[1] : 0;
      if (allowed === 0) {
        return {
          isAllowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, retryAfter),
          blockedReason: dimensions[i].reason,
        };
      }
    }

    const remaining = Array.isArray(results[0]) ? (results[0][2] ?? 0) : 0;

    return {
      isAllowed: true,
      remaining: Math.max(0, remaining),
      retryAfterSeconds: 0,
    };
  }

  async recordFailure(ip: string, emailHash?: string): Promise<void> {
    const pairs: { countKey: string; lockKey: string; tierKey: string }[] = [
      {
        countKey: `eventsika:admin:count:ip:${ip}`,
        lockKey: `eventsika:admin:lock:ip:${ip}`,
        tierKey: `eventsika:admin:tier:ip:${ip}`,
      },
    ];
    if (emailHash) {
      pairs.push(
        {
          countKey: `eventsika:admin:count:acc:${emailHash}`,
          lockKey: `eventsika:admin:lock:acc:${emailHash}`,
          tierKey: `eventsika:admin:tier:acc:${emailHash}`,
        },
        {
          countKey: `eventsika:admin:count:combo:${ip}:${emailHash}`,
          lockKey: `eventsika:admin:lock:combo:${ip}:${emailHash}`,
          tierKey: `eventsika:admin:tier:combo:${ip}:${emailHash}`,
        }
      );
    }

    const pipeline = this.redis.pipeline();
    for (const { countKey, lockKey, tierKey } of pairs) {
      pipeline.eval(RECORD_FAILURE_LUA, [countKey, lockKey, tierKey], [900]);
    }
    await pipeline.exec();
  }

  async recordSuccess(ip: string, emailHash?: string): Promise<void> {
    const keysToDelete = [
      `eventsika:admin:count:ip:${ip}`,
      `eventsika:admin:lock:ip:${ip}`,
      `eventsika:admin:tier:ip:${ip}`,
    ];
    if (emailHash) {
      keysToDelete.push(
        `eventsika:admin:count:acc:${emailHash}`,
        `eventsika:admin:lock:acc:${emailHash}`,
        `eventsika:admin:tier:acc:${emailHash}`,
        `eventsika:admin:count:combo:${ip}:${emailHash}`,
        `eventsika:admin:lock:combo:${ip}:${emailHash}`,
        `eventsika:admin:tier:combo:${ip}:${emailHash}`
      );
    }
    await this.redis.del(...keysToDelete);
  }

  async checkNamespaceLimit(
    ip: string,
    namespace: string,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const key = `eventsika:rate:${namespace}:${ip}`;
    const result = (await this.redis.eval(
      PUBLIC_RATE_LIMIT_LUA,
      [key],
      [windowSeconds]
    )) as [number, number];

    const current = Array.isArray(result) ? Number(result[0]) : 1;
    const ttl = Array.isArray(result) ? Number(result[1]) : windowSeconds;

    if (current <= limit) {
      return {
        isAllowed: true,
        remaining: Math.max(0, limit - current),
        resetTime: Date.now() + ttl * 1000,
        retryAfterSeconds: 0,
      };
    }

    return {
      isAllowed: false,
      remaining: 0,
      resetTime: Date.now() + ttl * 1000,
      retryAfterSeconds: Math.max(1, ttl),
    };
  }

  async clear(): Promise<void> {
    // Test utility
  }
}

/**
 * In-Memory Rate Limit Store for Development & Vitest.
 * Replicates exact dual-key, slot reservation, and progressive retention mathematics.
 */
interface MemoryEntry {
  count: number;
  tier: number;
  expiresAt: number;
  lockedUntil: number;
}

export class InMemoryAdminRateLimitStore implements IAdminRateLimitStore {
  private store = new Map<string, MemoryEntry>();

  async checkLimits(ip: string, emailHash?: string): Promise<AdminRateLimitResult> {
    const now = Date.now();
    const dimensions: { key: string; reason: "ip" | "account" | "combo" }[] = [
      { key: `ip:${ip}`, reason: "ip" },
    ];
    if (emailHash) {
      dimensions.push(
        { key: `acc:${emailHash}`, reason: "account" },
        { key: `combo:${ip}:${emailHash}`, reason: "combo" }
      );
    }

    // 1. Check if any dimension is currently in an active cooldown lock
    for (const { key, reason } of dimensions) {
      const entry = this.store.get(key);
      if (entry && entry.lockedUntil > now) {
        const retryAfter = Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000));
        return {
          isAllowed: false,
          remaining: 0,
          retryAfterSeconds: retryAfter,
          blockedReason: reason,
        };
      }
    }

    // 2. Atomically reserve an attempt across all dimensions
    let blockedReason: "ip" | "account" | "combo" | undefined;
    let maxCooldown = 0;

    for (const { key, reason } of dimensions) {
      let entry = this.store.get(key);
      if (!entry || now >= entry.expiresAt) {
        entry = { count: 0, tier: 1, expiresAt: now + 900_000, lockedUntil: 0 };
      }

      // Check if entity just completed a cooldown lock
      if (entry.lockedUntil > 0 && now >= entry.lockedUntil) {
        entry.tier = Math.min(3, entry.tier + 1);
        entry.lockedUntil = 0;
      }

      const allowedLimit = entry.tier * 5;

      if (entry.count >= allowedLimit) {
        let cooldown = 900_000;
        if (entry.tier >= 3) cooldown = 3600_000;
        else if (entry.tier === 2) cooldown = 1800_000;

        entry.lockedUntil = now + cooldown;
        entry.expiresAt = entry.lockedUntil + 900_000;
        blockedReason = reason;
        maxCooldown = Math.max(maxCooldown, cooldown);
        this.store.set(key, entry);
        continue;
      }

      entry.count += 1;
      entry.expiresAt = Math.max(entry.expiresAt, now + 900_000);
      this.store.set(key, entry);
    }

    if (blockedReason) {
      return {
        isAllowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(maxCooldown / 1000),
        blockedReason,
      };
    }

    const ipEntry = this.store.get(`ip:${ip}`);
    const remaining = ipEntry ? Math.max(0, ipEntry.tier * 5 - ipEntry.count) : 5;

    return {
      isAllowed: true,
      remaining,
      retryAfterSeconds: 0,
    };
  }

  async recordFailure(ip: string, emailHash?: string): Promise<void> {
    const now = Date.now();
    const keys = [`ip:${ip}`];
    if (emailHash) {
      keys.push(`acc:${emailHash}`, `combo:${ip}:${emailHash}`);
    }

    for (const key of keys) {
      const entry = this.store.get(key);
      if (!entry) continue;

      if (entry.count >= entry.tier * 5) {
        let cooldown = 900_000;
        if (entry.tier >= 3) {
          cooldown = 3600_000;
        } else if (entry.tier === 2) {
          cooldown = 1800_000;
        }

        entry.lockedUntil = now + cooldown;
        entry.expiresAt = entry.lockedUntil + 900_000; // Cooldown + 15m observation window
      }

      this.store.set(key, entry);
    }
  }

  async recordSuccess(ip: string, emailHash?: string): Promise<void> {
    this.store.delete(`ip:${ip}`);
    if (emailHash) {
      this.store.delete(`acc:${emailHash}`);
      this.store.delete(`combo:${ip}:${emailHash}`);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

// Singletons & test overrides
let customStoreOverride: IAdminRateLimitStore | null = null;
let upstashSingleton: UpstashRedisRateLimitStore | null = null;
const inMemorySingleton = new InMemoryAdminRateLimitStore();

export function _setAdminRateLimitStoreForTesting(store: IAdminRateLimitStore | null): void {
  customStoreOverride = store;
}

export function _resetAdminRateLimitsForTesting(): void {
  rateLimitStore.clear();
  inMemorySingleton.clear();
  customStoreOverride = null;
}

/**
 * Resolves the active rate limit store according to environment security boundaries:
 * - Production: Strictly requires Upstash Redis. Fails closed (isUnavailable: true) if unconfigured.
 * - Development/Test: Uses Upstash Redis if configured; safely falls back to InMemoryAdminRateLimitStore.
 */
export function getAdminRateLimitStore(): {
  store: IAdminRateLimitStore | null;
  isUnavailable: boolean;
} {
  if (customStoreOverride) {
    return { store: customStoreOverride, isUnavailable: false };
  }

  const isConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (isConfigured) {
    if (!upstashSingleton) {
      try {
        upstashSingleton = new UpstashRedisRateLimitStore();
      } catch (err) {
        logger.error("Failed to initialize Upstash Redis rate limit client", err);
        if (process.env.NODE_ENV === "production") {
          return { store: null, isUnavailable: true };
        }
      }
    }
    if (upstashSingleton) {
      return { store: upstashSingleton, isUnavailable: false };
    }
  }

  // Production Fail-Closed Guarantee
  if (process.env.NODE_ENV === "production") {
    return { store: null, isUnavailable: true };
  }

  // Non-production local fallback
  return { store: inMemorySingleton, isUnavailable: false };
}

/**
 * Evaluates whether an admin login attempt is permitted across IP, Account, and Combo layers.
 */
export async function checkAdminLoginRateLimit(
  request: Request,
  email?: string
): Promise<AdminRateLimitResult> {
  const { store, isUnavailable } = getAdminRateLimitStore();

  if (isUnavailable || !store) {
    return {
      isAllowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
      isUnavailable: true,
    };
  }

  try {
    const clientIp = getClientIp(request);
    const emailHash = email && email.trim() !== "" ? hashEmail(email) : undefined;
    return await store.checkLimits(clientIp, emailHash);
  } catch (err) {
    logger.error("Admin rate limiter datastore check failed", err);
    if (process.env.NODE_ENV === "production") {
      return {
        isAllowed: false,
        remaining: 0,
        retryAfterSeconds: 60,
        isUnavailable: true,
      };
    }
    return { isAllowed: true, remaining: 5, retryAfterSeconds: 0 };
  }
}

/**
 * Records a failed authentication attempt across IP, Account, and Combo layers.
 */
export async function recordAdminLoginFailure(request: Request, email: string): Promise<void> {
  const { store } = getAdminRateLimitStore();
  if (!store) return;

  try {
    const clientIp = getClientIp(request);
    const emailHash = email && email.trim() !== "" ? hashEmail(email) : undefined;
    await store.recordFailure(clientIp, emailHash);
  } catch (err) {
    logger.error("Failed to record admin login failure in datastore", err);
  }
}

/**
 * Resets failure counters for verified administrator across IP, Account, and Combo layers.
 */
export async function recordAdminLoginSuccess(request: Request, email: string): Promise<void> {
  const { store } = getAdminRateLimitStore();
  if (!store) return;

  try {
    const clientIp = getClientIp(request);
    const emailHash = email && email.trim() !== "" ? hashEmail(email) : undefined;
    await store.recordSuccess(clientIp, emailHash);
  } catch (err) {
    logger.error("Failed to clear admin login limits upon success", err);
  }
}
