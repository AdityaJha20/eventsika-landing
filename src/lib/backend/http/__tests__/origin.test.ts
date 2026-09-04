import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { isAllowedOrigin } from "../origin";

describe("Shared Origin & Cross-Site Request Verification (src/lib/backend/http/origin.ts)", () => {
  it("allows same-origin request when Origin matches Host", () => {
    const request = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      },
    });

    expect(isAllowedOrigin(request)).toBe(true);
  });

  it("rejects cross-site request when Sec-Fetch-Site is 'cross-site'", () => {
    const request = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://malicious-site.com",
        "sec-fetch-site": "cross-site",
      },
    });

    expect(isAllowedOrigin(request)).toBe(false);
  });

  it("rejects request when Origin host does not match request Host", () => {
    const request = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil-attacker.org",
      },
    });

    expect(isAllowedOrigin(request)).toBe(false);
  });

  it("permits non-browser / server-to-server request when both Origin and Sec-Fetch-Site are absent", () => {
    const request = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        host: "localhost:3000",
      },
    });

    expect(isAllowedOrigin(request)).toBe(true);
  });

  it("inspects Referer host if Origin is omitted and verifies match against Host", () => {
    const validRefererReq = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        referer: "http://localhost:3000/packages",
      },
    });
    expect(isAllowedOrigin(validRefererReq)).toBe(true);

    const invalidRefererReq = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        referer: "https://phishing-site.com/steal",
      },
    });
    expect(isAllowedOrigin(invalidRefererReq)).toBe(false);
  });

  it("safely rejects malformed Origin header strings without throwing unhandled exceptions", () => {
    const malformedReq = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "not-a-valid-url-format://",
      },
    });

    expect(isAllowedOrigin(malformedReq)).toBe(false);
  });
});
