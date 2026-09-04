import { describe, it, expect } from "vitest";
import {
  validateServerEnv,
  getServerConfig,
  assertProductionEnv,
} from "../env";

describe("Server Environment Validation (src/lib/backend/config/env.ts)", () => {
  const validProductionEnv: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    SUPABASE_URL: "https://example-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_pub_test_valid_key_12345",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_service_role_key_abcdef",
    UPSTASH_REDIS_REST_URL: "https://upstash.example.com",
    UPSTASH_REDIS_REST_TOKEN: "upstash_secret_token_123456",
    RESEND_API_KEY: "re_test_key_123456",
  };

  it("validates successfully when all required production variables are present", () => {
    const result = validateServerEnv(validProductionEnv);
    expect(result.isValid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("rejects when required production secrets are missing", () => {
    const incompleteEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      SUPABASE_URL: "https://example-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_pub_test_valid_key_12345",
      // Missing SUPABASE_SERVICE_ROLE_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
    };

    const result = validateServerEnv(incompleteEnv);
    expect(result.isValid).toBe(false);
    expect(result.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(result.missing).toContain("UPSTASH_REDIS_REST_URL");
    expect(result.missing).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("rejects empty or whitespace-only variables in production", () => {
    const whitespaceEnv: NodeJS.ProcessEnv = {
      ...validProductionEnv,
      SUPABASE_SERVICE_ROLE_KEY: "   ",
      UPSTASH_REDIS_REST_URL: "",
    };

    const result = validateServerEnv(whitespaceEnv);
    expect(result.isValid).toBe(false);
    expect(result.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(result.missing).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("never leaks secret values in missing or warning error lists", () => {
    const sensitiveValue = "ultra_secret_value_that_must_not_leak_9999";
    const testEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      SUPABASE_SERVICE_ROLE_KEY: sensitiveValue,
      // Missing redis
    };

    const result = validateServerEnv(testEnv);
    const serializedReport = JSON.stringify(result);

    expect(serializedReport).not.toContain(sensitiveValue);
  });

  it("permits missing production secrets in non-production development/test mode with advisory warnings", () => {
    const devEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      SUPABASE_URL: "https://example-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_pub_key",
    };

    const result = validateServerEnv(devEnv);
    expect(result.isValid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("assertProductionEnv throws descriptive error in production on missing secrets and passes when valid", () => {
    const invalidEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      SUPABASE_URL: "https://example.supabase.co",
    };

    expect(() => assertProductionEnv(invalidEnv)).toThrowError(
      /Missing required production environment variables/
    );

    expect(() => assertProductionEnv(validProductionEnv)).not.toThrow();
  });

  it("getServerConfig returns strongly-typed configuration object without modifying environment", () => {
    const config = getServerConfig(validProductionEnv);
    expect(config.isProduction).toBe(true);
    expect(config.supabase.url).toBe("https://example-project.supabase.co");
    expect(config.redis.isConfigured).toBe(true);
    expect(config.mailer.targetEmail).toBe("care@eventsika.in");
  });
});
