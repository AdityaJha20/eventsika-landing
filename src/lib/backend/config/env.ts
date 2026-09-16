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
  siteUrl: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
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

  // 2. Production Security Invariants
  if (isProduction) {
    if (!isNonEmptyString(env.SUPABASE_SERVICE_ROLE_KEY)) {
      missing.push("SUPABASE_SERVICE_ROLE_KEY");
    }

    if (!isNonEmptyString(env.UPSTASH_REDIS_REST_URL)) {
      missing.push("UPSTASH_REDIS_REST_URL");
    }

    if (!isNonEmptyString(env.UPSTASH_REDIS_REST_TOKEN)) {
      missing.push("UPSTASH_REDIS_REST_TOKEN");
    }

    // Cashfree Production Invariants
    if (!isNonEmptyString(env.CASHFREE_APP_ID)) {
      missing.push("CASHFREE_APP_ID");
    }

    if (!isNonEmptyString(env.CASHFREE_SECRET_KEY)) {
      missing.push("CASHFREE_SECRET_KEY");
    }

    const cashfreeEnvRaw = (env.CASHFREE_ENVIRONMENT || "").trim().toLowerCase();
    if (!cashfreeEnvRaw) {
      missing.push("CASHFREE_ENVIRONMENT (must be 'production' in production)");
    } else if (cashfreeEnvRaw !== "production") {
      missing.push(
        `CASHFREE_ENVIRONMENT (invalid value '${env.CASHFREE_ENVIRONMENT}'; must be 'production' in production)`
      );
    }
  } else {
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
    if (
      !isNonEmptyString(env.UPSTASH_REDIS_REST_URL) ||
      !isNonEmptyString(env.UPSTASH_REDIS_REST_TOKEN)
    ) {
      warnings.push(
        "UPSTASH_REDIS credentials unconfigured; rate limiters will use in-memory fallback in dev/test."
      );
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
