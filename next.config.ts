import type { NextConfig } from "next";

function getCspDirectives(): string {
  const isDev = process.env.NODE_ENV === "development";
  const directives = [
    "default-src 'self'",
    // unsafe-inline is required for Next.js hydration bootstrap scripts and static JSON-LD.
    // wasm-unsafe-eval is required for DotLottie WebAssembly player in production and development.
    // unsafe-eval is restricted strictly to local development for Next.js Fast Refresh tooling.
    // https://checkout.razorpay.com serves Razorpay Standard Checkout (checkout.js).
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://checkout.razorpay.com${isDev ? " 'unsafe-eval'" : ""}`,
    // unsafe-inline is required for Next.js CSS variable injection and CSS module styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "media-src 'self'",
    // Razorpay checkout.js talks to its API and its client telemetry endpoint.
    // Verify in the browser with test keys; tighten or extend only from observed CSP reports.
    "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
    // The Razorpay payment modal renders in a Razorpay-hosted iframe.
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];

  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runner stage (.next/standalone).
  output: "standalone",
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

