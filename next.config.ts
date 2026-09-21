import type { NextConfig } from "next";

function getCspDirectives(): string {
  const isDev = process.env.NODE_ENV === "development";
  const directives = [
    "default-src 'self'",
    // unsafe-inline is required for Next.js hydration bootstrap scripts and static JSON-LD.
    // unsafe-eval is restricted strictly to local development for Next.js Fast Refresh tooling.
    // https://sdk.cashfree.com is required for Cashfree Web Checkout SDK v3.
    `script-src 'self' 'unsafe-inline' https://sdk.cashfree.com${isDev ? " 'unsafe-eval'" : ""}`,
    // unsafe-inline is required for Next.js CSS variable injection and CSS module styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "media-src 'self'",
    "connect-src 'self' https://api.cashfree.com https://sandbox.cashfree.com",
    "frame-src 'self' https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://api.cashfree.com https://sandbox.cashfree.com",
    "frame-ancestors 'self'",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const securityHeaders = [
      { key: "Content-Security-Policy", value: getCspDirectives() },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];

    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

