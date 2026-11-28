/**
 * Startup configuration check (runs once per server instance).
 *
 * Reports missing/invalid production variables by NAME only. It does not stop the
 * marketing site from serving: payment routes independently fail closed (503) via
 * getPaymentReadiness() when Razorpay configuration is incomplete.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { validateServerEnv } = await import("./lib/backend/config/env");
  const result = validateServerEnv();
  if (!result.isValid) {
    console.error(`[startup-config] Invalid or missing environment variables: ${result.missing.join(", ")}`);
  }
  for (const warning of result.warnings) {
    console.warn(`[startup-config] ${warning}`);
  }
}
