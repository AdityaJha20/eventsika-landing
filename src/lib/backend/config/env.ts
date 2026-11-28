/**
 * Centralized Server & Application Environment Configuration & Validation
 *
 * Enforces strict environment classification:
 * - Public: Supabase URL and Publishable/Anon keys (safe for browser & SSR).
 * - Server-Required in Production: Service Role Key & Upstash Redis credentials.
 * - Server-Optional: Mailer API keys (Resend, SendGrid, Webhook) with safe fallback.
 *
 * Security Invariants:
 * - Rejects empty and whitespace-only strings.
 * - Error reporting emits variable names ONLY, never secret values.
 * - Safe for Next.js App Router: Does not throw on module import during build-time evaluation.
 */

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

export interface CashfreeConfig {
  appId?: string;
  secretKey?: string;
  environment: "sandbox" | "production";
  baseUrl: string;
  isConfigured: boolean;
}

export interface ServerConfig {
  supabase: {
    url: string;
    publishableKey: string;
    serviceRoleKey?: string;
  };
  rateLimit: {
    backend: "memory" | "upstash";
    isMemory: boolean;
  };
  redis: {
    url?: string;
    token?: string;
    isConfigured: boolean;
  };
  mailer: {
    targetEmail: string;
    fromEmail: string;
    resendApiKey?: string;
    sendgridApiKey?: string;
    webhookUrl?: string;
  };
  cashfree: CashfreeConfig;
  razorpay: RazorpayConfig;
  payments: PaymentsConfig;
  siteUrl: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
}

export interface RazorpayConfig {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  mode?: "test" | "live";
  baseUrl: string;
  /** Problems that make Razorpay unusable (names only, never values). */
  configErrors: string[];
  isConfigured: boolean;
}

export interface PaymentsConfig {
  /** Provider for NEW payment attempts. Only Razorpay is accepted. */
  provider: "razorpay";
  /** Server-side kill switch: blocks new reservations/orders only. */
  killSwitchActive: boolean;
  /** Bearer secret for the scheduled reconciliation trigger (optional). */
  reconciliationSecret?: string;
}

/**
 * Validates Razorpay settings. Returns variable names / reasons only.
 * `required` is true in production, where every gap is fatal for payments.
 */
export function getRazorpayConfigErrors(env: NodeJS.ProcessEnv, required: boolean): string[] {
  const errors: string[] = [];
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const mode = env.RAZORPAY_MODE?.trim().toLowerCase();
  const provider = env.PAYMENT_PROVIDER?.trim().toLowerCase();

  if (provider && provider !== "razorpay") {
    errors.push(`PAYMENT_PROVIDER (invalid value; only 'razorpay' may take new payments)`);
  }
  if (!keyId) {
    if (required) errors.push("RAZORPAY_KEY_ID");
  } else if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    errors.push("RAZORPAY_KEY_ID (unexpected format)");
  }
  if (!keySecret && required) errors.push("RAZORPAY_KEY_SECRET");
  if (!webhookSecret && required) errors.push("RAZORPAY_WEBHOOK_SECRET");
  if (keySecret && webhookSecret && keySecret === webhookSecret) {
    errors.push("RAZORPAY_WEBHOOK_SECRET (must differ from RAZORPAY_KEY_SECRET)");
  }
  if (!mode) {
    if (required) errors.push("RAZORPAY_MODE (must be 'test' or 'live')");
  } else if (mode !== "test" && mode !== "live") {
    errors.push("RAZORPAY_MODE (must be 'test' or 'live')");
  } else if (keyId && !keyId.startsWith(`rzp_${mode}_`)) {
    errors.push(`RAZORPAY_KEY_ID (does not match RAZORPAY_MODE='${mode}')`);
  }
  return errors;
}

/**
 * Validates candidate string value ensuring it exists and is not whitespace-only.
 */
function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

/**
 * Validates server environment variables according to active runtime mode.
 */
export function validateServerEnv(
  env: NodeJS.ProcessEnv = process.env
): EnvValidationResult {
  const isProduction = env.NODE_ENV === "production";
  const missing: string[] = [];
  const warnings: string[] = [];

  // 1. Supabase Public / SSR Key (Required in all environments)
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  if (!isNonEmptyString(supabaseUrl)) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)");
  }

  const supabasePublishableKey =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY;
  if (!isNonEmptyString(supabasePublishableKey)) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }

  // 2. Rate Limiting Backend & Production Security Invariants
  const rateLimitBackendRaw = (env.RATE_LIMIT_BACKEND || "").trim().toLowerCase();
  const isMemoryRateLimit = rateLimitBackendRaw === "memory";

  if (
    rateLimitBackendRaw &&
    rateLimitBackendRaw !== "memory" &&
    rateLimitBackendRaw !== "upstash" &&
    rateLimitBackendRaw !== "redis"
  ) {
    missing.push(
      `RATE_LIMIT_BACKEND (invalid value '${env.RATE_LIMIT_BACKEND}'; must be 'memory' or 'upstash')`
    );
  }

  if (isProduction) {
    if (!isNonEmptyString(env.SUPABASE_SERVICE_ROLE_KEY)) {
      missing.push("SUPABASE_SERVICE_ROLE_KEY");
    }

    if (!isMemoryRateLimit) {
      if (!isNonEmptyString(env.UPSTASH_REDIS_REST_URL)) {
        missing.push("UPSTASH_REDIS_REST_URL");
      }

      if (!isNonEmptyString(env.UPSTASH_REDIS_REST_TOKEN)) {
        missing.push("UPSTASH_REDIS_REST_TOKEN");
      }
    } else {
      warnings.push(
        "RATE_LIMIT_BACKEND is set to 'memory' in production. Rate limits will be stored in-memory (per process, non-distributed) and reset upon restart."
      );
    }

    // Razorpay takes every new payment: its configuration is mandatory.
    missing.push(...getRazorpayConfigErrors(env, true));

    // Cashfree is legacy-only (late webhooks for historical orders). Missing
    // credentials degrade legacy verification but must not block startup.
    if (!isNonEmptyString(env.CASHFREE_SECRET_KEY)) {
      warnings.push(
        "CASHFREE_SECRET_KEY is unconfigured; late webhooks for legacy Cashfree orders cannot be verified."
      );
    }

    const cashfreeEnvRaw = (env.CASHFREE_ENVIRONMENT || "").trim().toLowerCase();
    if (cashfreeEnvRaw && cashfreeEnvRaw !== "production") {
      missing.push(
        `CASHFREE_ENVIRONMENT (invalid value '${env.CASHFREE_ENVIRONMENT}'; must be 'production' in production)`
      );
    }
  } else {
    missing.push(...getRazorpayConfigErrors(env, false));
    if (!isNonEmptyString(env.RAZORPAY_KEY_ID) || !isNonEmptyString(env.RAZORPAY_KEY_SECRET)) {
      warnings.push(
        "Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, RAZORPAY_MODE) are unconfigured; payment routes will return 503."
      );
    }

    // Non-production checks
    const cashfreeEnvRaw = (env.CASHFREE_ENVIRONMENT || "").trim().toLowerCase();
    if (cashfreeEnvRaw && cashfreeEnvRaw !== "sandbox" && cashfreeEnvRaw !== "production") {
      missing.push(
        `CASHFREE_ENVIRONMENT (invalid value '${env.CASHFREE_ENVIRONMENT}'; must be 'sandbox' or 'production')`
      );
    }

    // Non-production advisory checks
    if (!isNonEmptyString(env.SUPABASE_SERVICE_ROLE_KEY)) {
      warnings.push(
        "SUPABASE_SERVICE_ROLE_KEY is unconfigured; database persistence will use in-memory fallback repository in dev/test."
      );
    }
    if (!isMemoryRateLimit) {
      if (
        !isNonEmptyString(env.UPSTASH_REDIS_REST_URL) ||
        !isNonEmptyString(env.UPSTASH_REDIS_REST_TOKEN)
      ) {
        warnings.push(
          "UPSTASH_REDIS credentials unconfigured; rate limiters will use in-memory fallback in dev/test."
        );
      }
    }
    if (
      !isNonEmptyString(env.CASHFREE_APP_ID) ||
      !isNonEmptyString(env.CASHFREE_SECRET_KEY)
    ) {
      warnings.push(
        "Cashfree payment gateway credentials (CASHFREE_APP_ID, CASHFREE_SECRET_KEY) are unconfigured; live gateway execution will require credentials."
      );
    }
  }

  // 3. Optional Mailer Providers
  if (
    !isNonEmptyString(env.RESEND_API_KEY) &&
    !isNonEmptyString(env.SENDGRID_API_KEY) &&
    !isNonEmptyString(env.LEAD_WEBHOOK_URL)
  ) {
    warnings.push(
      "External notification provider (RESEND_API_KEY, SENDGRID_API_KEY, or LEAD_WEBHOOK_URL) is unconfigured; submissions will fall back to logger."
    );
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Returns strongly-typed configuration object derived from environment.
 */
export function getServerConfig(
  env: NodeJS.ProcessEnv = process.env
): ServerConfig {
  const isProduction = env.NODE_ENV === "production";
  const isDevelopment = env.NODE_ENV === "development";
  const isTest = env.NODE_ENV === "test";

  const supabaseUrl = (
    env.SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();

  const publishableKey = (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    ""
  ).trim();

  const serviceRoleKey = isNonEmptyString(env.SUPABASE_SERVICE_ROLE_KEY)
    ? env.SUPABASE_SERVICE_ROLE_KEY.trim()
    : undefined;

  const redisUrl = isNonEmptyString(env.UPSTASH_REDIS_REST_URL)
    ? env.UPSTASH_REDIS_REST_URL.trim()
    : undefined;

  const redisToken = isNonEmptyString(env.UPSTASH_REDIS_REST_TOKEN)
    ? env.UPSTASH_REDIS_REST_TOKEN.trim()
    : undefined;

  const rateLimitBackendRaw = (env.RATE_LIMIT_BACKEND || "").trim().toLowerCase();
  const isMemoryRateLimit = rateLimitBackendRaw === "memory";
  const rateLimitBackend: "memory" | "upstash" = isMemoryRateLimit ? "memory" : "upstash";

  const cashfreeAppId = isNonEmptyString(env.CASHFREE_APP_ID)
    ? env.CASHFREE_APP_ID.trim()
    : undefined;

  const cashfreeSecretKey = isNonEmptyString(env.CASHFREE_SECRET_KEY)
    ? env.CASHFREE_SECRET_KEY.trim()
    : undefined;

  const cashfreeEnvRaw = (env.CASHFREE_ENVIRONMENT || "").trim().toLowerCase();
  let cashfreeEnvironment: "sandbox" | "production";

  if (cashfreeEnvRaw === "production") {
    cashfreeEnvironment = "production";
  } else if (cashfreeEnvRaw === "sandbox") {
    cashfreeEnvironment = "sandbox";
  } else if (!cashfreeEnvRaw && !isProduction) {
    cashfreeEnvironment = "sandbox";
  } else if (!cashfreeEnvRaw && isProduction) {
    // In production without explicit environment setting, resolve strictly to production
    // to prevent any possibility of silent sandbox leakage
    cashfreeEnvironment = "production";
  } else {
    throw new Error(
      `Invalid CASHFREE_ENVIRONMENT: "${env.CASHFREE_ENVIRONMENT}". Must be "sandbox" or "production".`
    );
  }

  const cashfreeBaseUrl =
    cashfreeEnvironment === "production"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";

  return {
    supabase: {
      url: supabaseUrl,
      publishableKey,
      serviceRoleKey,
    },
    rateLimit: {
      backend: rateLimitBackend,
      isMemory: isMemoryRateLimit,
    },
    redis: {
      url: redisUrl,
      token: redisToken,
      isConfigured: Boolean(redisUrl && redisToken),
    },
    mailer: {
      targetEmail: isNonEmptyString(env.NOTIFICATION_EMAIL)
        ? env.NOTIFICATION_EMAIL.trim()
        : "care@eventsika.in",
      fromEmail: isNonEmptyString(env.EMAIL_FROM)
        ? env.EMAIL_FROM.trim()
        : "Eventsika <care@eventsika.in>",
      resendApiKey: isNonEmptyString(env.RESEND_API_KEY)
        ? env.RESEND_API_KEY.trim()
        : undefined,
      sendgridApiKey: isNonEmptyString(env.SENDGRID_API_KEY)
        ? env.SENDGRID_API_KEY.trim()
        : undefined,
      webhookUrl: isNonEmptyString(env.LEAD_WEBHOOK_URL)
        ? env.LEAD_WEBHOOK_URL.trim()
        : undefined,
    },
    cashfree: {
      appId: cashfreeAppId,
      secretKey: cashfreeSecretKey,
      environment: cashfreeEnvironment,
      baseUrl: cashfreeBaseUrl,
      isConfigured: Boolean(cashfreeAppId && cashfreeSecretKey),
    },
    razorpay: buildRazorpayConfig(env),
    payments: {
      provider: "razorpay",
      killSwitchActive: ["1", "true", "on", "yes"].includes(
        (env.PAYMENTS_KILL_SWITCH || "").trim().toLowerCase()
      ),
      reconciliationSecret:
        isNonEmptyString(env.PAYMENT_RECONCILIATION_SECRET) &&
        env.PAYMENT_RECONCILIATION_SECRET.trim().length >= 32
          ? env.PAYMENT_RECONCILIATION_SECRET.trim()
          : undefined,
    },
    siteUrl: isNonEmptyString(env.NEXT_PUBLIC_SITE_URL)
      ? env.NEXT_PUBLIC_SITE_URL.trim()
      : "https://eventsika.in",
    isProduction,
    isDevelopment,
    isTest,
  };
}

/**
 * Asserts production configuration validity. Throws detailed error if required secrets are missing.
 * Should be called explicitly when production readiness is asserted.
 */
export function assertProductionEnv(
  env: NodeJS.ProcessEnv = process.env
): void {
  const result = validateServerEnv(env);
  if (!result.isValid) {
    throw new Error(
      `[Security Config Error] Missing required production environment variables: ${result.missing.join(
        ", "
      )}`
    );
  }
}

function buildRazorpayConfig(env: NodeJS.ProcessEnv): RazorpayConfig {
  const keyId = isNonEmptyString(env.RAZORPAY_KEY_ID) ? env.RAZORPAY_KEY_ID.trim() : undefined;
  const keySecret = isNonEmptyString(env.RAZORPAY_KEY_SECRET) ? env.RAZORPAY_KEY_SECRET.trim() : undefined;
  const webhookSecret = isNonEmptyString(env.RAZORPAY_WEBHOOK_SECRET)
    ? env.RAZORPAY_WEBHOOK_SECRET.trim()
    : undefined;
  const modeRaw = (env.RAZORPAY_MODE || "").trim().toLowerCase();
  const mode = modeRaw === "test" || modeRaw === "live" ? modeRaw : undefined;
  // Payments always need the full set, even outside production, so a half-configured
  // environment fails closed instead of creating orders it cannot verify.
  const configErrors = getRazorpayConfigErrors(env, true);
  return {
    keyId,
    keySecret,
    webhookSecret,
    mode,
    baseUrl: "https://api.razorpay.com/v1",
    configErrors,
    isConfigured: configErrors.length === 0,
  };
}

/**
 * Payment readiness gate used by every payment route. Fails closed: when Razorpay is
 * not fully and consistently configured, payment operations return 503.
 */
export function getPaymentReadiness(env: NodeJS.ProcessEnv = process.env): {
  ready: boolean;
  problems: string[];
} {
  const problems = getRazorpayConfigErrors(env, true);
  return { ready: problems.length === 0, problems };
}
