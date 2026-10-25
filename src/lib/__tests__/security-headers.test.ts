import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Next.js Security Headers Configuration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("configures strict Content-Security-Policy with required restrictive properties", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const nextConfigModule = await import("../../../next.config");
    const nextConfig = nextConfigModule.default;

    const headersConfig = await nextConfig.headers!();
    const globalRule = headersConfig.find((rule: { source: string }) => rule.source === "/(.*)");
    expect(globalRule).toBeDefined();

    const headers = globalRule!.headers;
    const cspHeader = headers.find((h: { key: string }) => h.key === "Content-Security-Policy");
    expect(cspHeader).toBeDefined();

    const csp = cspHeader!.value;

    // 1. Mandatory Restrictive Directives
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("upgrade-insecure-requests");

    // 2. Production Security Invariant: JavaScript unsafe-eval MUST NOT be present in production
    expect(csp).not.toContain("'unsafe-eval'");
    // WebAssembly compilation for DotLottie player requires wasm-unsafe-eval
    expect(csp).toContain("'wasm-unsafe-eval'");

    // 3. Prohibit Overly Permissive / Wildcard Sources
    expect(csp).not.toContain("default-src *");
    expect(csp).not.toContain("script-src *");
    expect(csp).not.toContain("connect-src *");
  });

  it("includes HSTS strictly in production context", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const nextConfigModule = await import("../../../next.config");
    const nextConfig = nextConfigModule.default;

    const headersConfig = await nextConfig.headers!();
    const globalRule = headersConfig.find((rule: { source: string }) => rule.source === "/(.*)");
    expect(globalRule).toBeDefined();

    const hstsHeader = globalRule!.headers.find((h: { key: string }) => h.key === "Strict-Transport-Security");

    expect(hstsHeader).toBeDefined();
    expect(hstsHeader!.value).toContain("max-age=63072000");
    expect(hstsHeader!.value).toContain("includeSubDomains");
    expect(hstsHeader!.value).toContain("preload");
  });

  it("omits HSTS in development to avoid breaking localhost HTTP development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const nextConfigModule = await import("../../../next.config");
    const nextConfig = nextConfigModule.default;

    const headersConfig = await nextConfig.headers!();
    const globalRule = headersConfig.find((rule: { source: string }) => rule.source === "/(.*)");
    expect(globalRule).toBeDefined();

    const hstsHeader = globalRule!.headers.find((h: { key: string }) => h.key === "Strict-Transport-Security");

    expect(hstsHeader).toBeUndefined();
  });

  it("preserves baseline security headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const nextConfigModule = await import("../../../next.config");
    const nextConfig = nextConfigModule.default;

    const headersConfig = await nextConfig.headers!();
    const headers = headersConfig[0].headers;

    const getHeader = (key: string) => headers.find((h: { key: string }) => h.key === key)?.value;

    expect(getHeader("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(getHeader("X-Content-Type-Options")).toBe("nosniff");
    expect(getHeader("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(getHeader("Permissions-Policy")).toContain("camera=()");
  });

  it("permits wasm-unsafe-eval in production script-src while isolating unsafe-eval to development", async () => {
    // Production check
    vi.stubEnv("NODE_ENV", "production");
    const prodConfigModule = await import("../../../next.config");
    const prodHeaders = await prodConfigModule.default.headers!();
    const prodCsp = prodHeaders.find((r: { source: string }) => r.source === "/(.*)")!.headers.find(
      (h: { key: string }) => h.key === "Content-Security-Policy"
    )!.value;

    const prodScriptSrc = prodCsp
      .split(";")
      .map((d: string) => d.trim())
      .find((d: string) => d.startsWith("script-src "));

    expect(prodScriptSrc).toBeDefined();
    expect(prodScriptSrc).toContain("'wasm-unsafe-eval'");
    expect(prodScriptSrc).not.toContain("'unsafe-eval'");

    // Development check
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    const devConfigModule = await import("../../../next.config");
    const devHeaders = await devConfigModule.default.headers!();
    const devCsp = devHeaders.find((r: { source: string }) => r.source === "/(.*)")!.headers.find(
      (h: { key: string }) => h.key === "Content-Security-Policy"
    )!.value;

    const devScriptSrc = devCsp
      .split(";")
      .map((d: string) => d.trim())
      .find((d: string) => d.startsWith("script-src "));

    expect(devScriptSrc).toBeDefined();
    expect(devScriptSrc).toContain("'wasm-unsafe-eval'");
    expect(devScriptSrc).toContain("'unsafe-eval'");
  });
});
