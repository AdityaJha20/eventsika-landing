import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { vendorService } from "@/lib/backend/services/vendor-service";

describe("POST /api/vendor-applications Integration Contract", () => {
  const getValidVendorPayload = () => ({
    businessName: "Royal Floral Concepts",
    contactName: "Vikram Sharma",
    phone: "9876543210",
    email: "vikram@royalflorals.in",
    city: "Mumbai",
    experience: "3–5 Years",
    portfolioUrl: "https://instagram.com/royalfloralconcepts",
    categories: ["Decor & Styling"],
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Happy path partner submission", () => {
    it("returns HTTP 200, success: true, and X-Request-Id header for valid application", async () => {
      vi.spyOn(vendorService, "processVendorApplication").mockResolvedValueOnce({
        success: true,
        applicationId: "test-app-uuid",
        message: "Vendor application submitted successfully.",
      });

      const request = new NextRequest("http://localhost:3000/api/vendor-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
          "x-real-ip": "198.51.100.20",
        },
        body: JSON.stringify(getValidVendorPayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBeDefined();
      expect(response.headers.get("X-Request-Id")).toBeTruthy();
    });
  });

  describe("Cross-origin submission protection", () => {
    it("rejects cross-origin requests with HTTP 403 and prevents vendor application processing", async () => {
      const processVendorSpy = vi.spyOn(vendorService, "processVendorApplication");

      const request = new NextRequest("http://localhost:3000/api/vendor-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "https://external-spam-site.com",
          "sec-fetch-site": "cross-site",
          "x-real-ip": "198.51.100.21",
        },
        body: JSON.stringify(getValidVendorPayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Cross-origin submission blocked.");
      expect(processVendorSpy).not.toHaveBeenCalled();
    });
  });

  describe("Payload size and malformed input guards", () => {
    it("returns HTTP 413 when payload exceeds 50 KB ceiling", async () => {
      const processVendorSpy = vi.spyOn(vendorService, "processVendorApplication");

      const request = new NextRequest("http://localhost:3000/api/vendor-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "60000",
          "x-real-ip": "198.51.100.22",
        },
        body: JSON.stringify(getValidVendorPayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.success).toBe(false);
      expect(processVendorSpy).not.toHaveBeenCalled();
    });

    it("returns HTTP 400 when body is malformed JSON", async () => {
      const processVendorSpy = vi.spyOn(vendorService, "processVendorApplication");

      const request = new NextRequest("http://localhost:3000/api/vendor-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.23",
        },
        body: "invalid-json",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(processVendorSpy).not.toHaveBeenCalled();
    });
  });

  describe("Validation schema failure boundary", () => {
    it("returns HTTP 400 and does NOT call vendor service when validation fails", async () => {
      const processVendorSpy = vi.spyOn(vendorService, "processVendorApplication");

      const invalidPayload = {
        ...getValidVendorPayload(),
        phone: "123", // Invalid phone
      };

      const request = new NextRequest("http://localhost:3000/api/vendor-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.24",
        },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(processVendorSpy).not.toHaveBeenCalled();
    });
  });

  describe("Rate limiting isolation", () => {
    it("returns HTTP 429 when rate limit of 5 requests per 10 min is exceeded on dedicated IP", async () => {
      vi.spyOn(vendorService, "processVendorApplication").mockResolvedValue({
        success: true,
        applicationId: "test-app-uuid",
        message: "Vendor application submitted successfully.",
      });

      const dedicatedIp = "198.51.100.55";

      for (let i = 0; i < 5; i++) {
        const req = new NextRequest("http://localhost:3000/api/vendor-applications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-real-ip": dedicatedIp,
          },
          body: JSON.stringify(getValidVendorPayload()),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
      }

      // 6th request triggers 429
      const blockedReq = new NextRequest("http://localhost:3000/api/vendor-applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": dedicatedIp,
        },
        body: JSON.stringify(getValidVendorPayload()),
      });
      const blockedRes = await POST(blockedReq);
      const blockedData = await blockedRes.json();

      expect(blockedRes.status).toBe(429);
      expect(blockedData.success).toBe(false);
      expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    });
  });
});
