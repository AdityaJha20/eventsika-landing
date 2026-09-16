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
    CASHFREE_APP_ID: "cf_app_prod_123456",
    CASHFREE_SECRET_KEY: "cf_sec_prod_abcdef123456",
    CASHFREE_ENVIRONMENT: "production",
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
      // Missing SUPABASE_SERVICE_ROLE_KEY, UPSTASH_REDIS, and CASHFREE production invariants
    };

    const result = validateServerEnv(incompleteEnv);
    expect(result.isValid).toBe(false);
    expect(result.missing).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(result.missing).toContain("UPSTASH_REDIS_REST_URL");
    expect(result.missing).toContain("UPSTASH_REDIS_REST_TOKEN");
    expect(result.missing).toContain("CASHFREE_APP_ID");
    expect(result.missing).toContain("CASHFREE_SECRET_KEY");
    expect(result.missing.some((m) => m.includes("CASHFREE_ENVIRONMENT"))).toBe(true);
  });

  it("rejects when CASHFREE_APP_ID or CASHFREE_SECRET_KEY is missing in production", () => {
    const missingAppId: NodeJS.ProcessEnv = {
      ...validProductionEnv,
      CASHFREE_APP_ID: undefined,
    };
    const res1 = validateServerEnv(missingAppId);
    expect(res1.isValid).toBe(false);
    expect(res1.missing).toContain("CASHFREE_APP_ID");

    const missingSecret: NodeJS.ProcessEnv = {
      ...validProductionEnv,
      CASHFREE_SECRET_KEY: "   ",
    };
    const res2 = validateServerEnv(missingSecret);
    expect(res2.isValid).toBe(false);
    expect(res2.missing).toContain("CASHFREE_SECRET_KEY");
  });

  it("rejects when CASHFREE_ENVIRONMENT is missing or invalid in production", () => {
    // Missing CASHFREE_ENVIRONMENT in production
    const missingEnv: NodeJS.ProcessEnv = {
      ...validProductionEnv,
      CASHFREE_ENVIRONMENT: undefined,
    };
    const resMissing = validateServerEnv(missingEnv);
    expect(resMissing.isValid).toBe(false);
    expect(
      resMissing.missing.some((m) => m.includes("CASHFREE_ENVIRONMENT (must be 'production' in production)"))
    ).toBe(true);

    // Sandbox in production must fail validation
    const sandboxInProd: NodeJS.ProcessEnv = {
      ...validProductionEnv,
      CASHFREE_ENVIRONMENT: "sandbox",
    };
    const resSandbox = validateServerEnv(sandboxInProd);
    expect(resSandbox.isValid).toBe(false);
    expect(
      resSandbox.missing.some((m) => m.includes("invalid value 'sandbox'; must be 'production' in production"))
    ).toBe(true);

    // Invalid string (e.g. 'prod', 'live', 'staging') in production must fail validation
    for (const invalidVal of ["prod", "live", "staging", "dev"]) {
      const res = validateServerEnv({
        ...validProductionEnv,
        CASHFREE_ENVIRONMENT: invalidVal,
      });
      expect(res.isValid).toBe(false);
      expect(res.missing.some((m) => m.includes("CASHFREE_ENVIRONMENT"))).toBe(true);
    }
  });

  it("rejects invalid explicit CASHFREE_ENVIRONMENT values in non-production", () => {
    for (const invalidVal of ["prod", "live", "staging", "unknown"]) {
      const devEnvWithInvalid: NodeJS.ProcessEnv = {
        NODE_ENV: "development",
        SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_pub_key",
        CASHFREE_ENVIRONMENT: invalidVal,
      };
      const result = validateServerEnv(devEnvWithInvalid);
      expect(result.isValid).toBe(false);
      expect(
        result.missing.some((m) => m.includes("must be 'sandbox' or 'production'"))
      ).toBe(true);
    }
  });

  it("accepts valid CASHFREE_ENVIRONMENT values ('sandbox' or 'production') in non-production", () => {
    for (const validVal of ["sandbox", "production"]) {
      const devEnv: NodeJS.ProcessEnv = {
        NODE_ENV: "development",
        SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_pub_key",
        CASHFREE_ENVIRONMENT: validVal,
      };
      const result = validateServerEnv(devEnv);
      expect(result.isValid).toBe(true);
      expect(result.missing).toHaveLength(0);
    }
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
      CASHFREE_SECRET_KEY: sensitiveValue,
      // Missing redis & app id
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
    expect(result.warnings.some((w) => w.includes("SUPABASE_SERVICE_ROLE_KEY"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("CASHFREE_APP_ID"))).toBe(true);
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
    expect(config.cashfree.appId).toBe("cf_app_prod_123456");
    expect(config.cashfree.secretKey).toBe("cf_sec_prod_abcdef123456");
    expect(config.cashfree.environment).toBe("production");
    expect(config.cashfree.baseUrl).toBe("https://api.cashfree.com/pg");
    expect(config.cashfree.isConfigured).toBe(true);
    // Assert apiVersion is NOT in CashfreeConfig
    expect("apiVersion" in config.cashfree).toBe(false);
  });

  it("getServerConfig defaults to sandbox in non-production when CASHFREE_ENVIRONMENT is unset", () => {
    const devEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_pub_key",
    };
    const config = getServerConfig(devEnv);
    expect(config.cashfree.environment).toBe("sandbox");
    expect(config.cashfree.baseUrl).toBe("https://sandbox.cashfree.com/pg");
  });

  it("getServerConfig throws when CASHFREE_ENVIRONMENT contains an invalid value", () => {
    const badEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "development",
      SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_pub_key",
      CASHFREE_ENVIRONMENT: "invalid_env",
    };
    expect(() => getServerConfig(badEnv)).toThrow(
      /Invalid CASHFREE_ENVIRONMENT: "invalid_env"/
    );
  });
});
