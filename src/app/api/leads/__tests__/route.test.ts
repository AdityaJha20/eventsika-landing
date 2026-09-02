import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { leadService } from "@/lib/backend/services/lead-service";

describe("POST /api/leads Integration Contract", () => {
  const getFutureDateString = (daysAhead = 30): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getValidLeadPayload = () => ({
    userName: "Meera Sen",
    userPhone: "9876543210",
    city: "Delhi",
    eventType: "Birthday",
    eventDate: getFutureDateString(60),
    guestCount: "30–50 guests",
    venueType: "Indoor",
    selectedServices: ["Decor & Styling"],
    budgetRange: "₹50,000 – ₹1,00,000",
    whatsappConsent: true,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Happy path submission", () => {
    it("returns HTTP 200, success: true, and X-Request-Id header for valid lead", async () => {
      vi.spyOn(leadService, "processLead").mockResolvedValueOnce({
        success: true,
        leadId: "test-lead-uuid",
        message: "Your celebration plan request has been received.",
      });

      const request = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.10",
        },
        body: JSON.stringify(getValidLeadPayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBeDefined();
      expect(response.headers.get("X-Request-Id")).toBeTruthy();
    });
  });

  describe("Payload size and malformed input guards", () => {
    it("returns HTTP 413 when payload exceeds 50 KB ceiling", async () => {
      const processLeadSpy = vi.spyOn(leadService, "processLead");

      const request = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "60000",
          "x-real-ip": "198.51.100.11",
        },
        body: JSON.stringify(getValidLeadPayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.success).toBe(false);
      expect(processLeadSpy).not.toHaveBeenCalled();
    });

    it("returns HTTP 400 when body is malformed or invalid JSON", async () => {
      const processLeadSpy = vi.spyOn(leadService, "processLead");

      const request = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.12",
        },
        body: "invalid-non-json-string",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(processLeadSpy).not.toHaveBeenCalled();
    });
  });

  describe("Validation schema failure and persistence boundary", () => {
    it("returns HTTP 400 and ensures persistence service is NEVER called when validation fails", async () => {
      const processLeadSpy = vi.spyOn(leadService, "processLead");

      const invalidPayload = {
        ...getValidLeadPayload(),
        userPhone: "12345", // Invalid phone
      };

      const request = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.13",
        },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBeDefined();
      expect(processLeadSpy).not.toHaveBeenCalled();
    });
  });

  describe("Rate limiting isolation", () => {
    it("returns HTTP 429 when rate limit of 5 requests per 10 min is exceeded on dedicated IP", async () => {
      vi.spyOn(leadService, "processLead").mockResolvedValue({
        success: true,
        leadId: "test-lead-uuid",
        message: "Your celebration plan request has been received.",
      });

      const dedicatedIp = "198.51.100.99";

      // Make 5 permitted requests
      for (let i = 0; i < 5; i++) {
        const req = new NextRequest("http://localhost:3000/api/leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-real-ip": dedicatedIp,
          },
          body: JSON.stringify(getValidLeadPayload()),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
      }

      // 6th request should trigger HTTP 429
      const blockedReq = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": dedicatedIp,
        },
        body: JSON.stringify(getValidLeadPayload()),
      });
      const blockedRes = await POST(blockedReq);
      const blockedData = await blockedRes.json();

      expect(blockedRes.status).toBe(429);
      expect(blockedData.success).toBe(false);
      expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    });
  });

  describe("Backend persistence failure handling", () => {
    it("returns HTTP 500 when LeadService reports persistence failure", async () => {
      vi.spyOn(leadService, "processLead").mockResolvedValueOnce({
        success: false,
        message: "Unable to save your celebration details. Please try again.",
      });

      const request = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.14",
        },
        body: JSON.stringify(getValidLeadPayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBeDefined();
    });
  });

  describe("Trusted field injection immunity", () => {
    it("sanitizes injected internal fields without failing or corrupting server metadata", async () => {
      const processLeadSpy = vi.spyOn(leadService, "processLead").mockResolvedValueOnce({
        success: true,
        leadId: "test-lead-uuid",
        message: "Your celebration plan request has been received.",
      });

      const pollutedPayload = {
        ...getValidLeadPayload(),
        id: "injected-admin-uuid",
        created_at: "2000-01-01T00:00:00Z",
        status: "APPROVED_SUPERUSER",
      };

      const request = new NextRequest("http://localhost:3000/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.15",
        },
        body: JSON.stringify(pollutedPayload),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify that processLead was called with clean object lacking injected fields
      expect(processLeadSpy).toHaveBeenCalledTimes(1);
      const processedLead = processLeadSpy.mock.calls[0][0];
      expect((processedLead as unknown as Record<string, unknown>).id).toBeUndefined();
      expect((processedLead as unknown as Record<string, unknown>).created_at).toBeUndefined();
      expect((processedLead as unknown as Record<string, unknown>).status).toBeUndefined();
    });
  });
});
