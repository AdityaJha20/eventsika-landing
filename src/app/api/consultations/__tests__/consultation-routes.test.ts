import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../slots/route";
import { POST } from "../reserve/route";
import { consultationBookingService } from "@/lib/backend/services/consultation-booking-service";

describe("Consultation Routes (GET /slots and POST /reserve)", () => {
  const validSlotId = "11111111-1111-4111-8111-111111111111";

  const getValidReservePayload = () => ({
    customerFirstName: "Ananya",
    customerLastName: "Verma",
    customerPhone: "9876543210",
    customerEmail: "ananya.verma@example.com",
    customerCity: "Mumbai",
    eventType: "Wedding",
    eventTypeOther: null,
    guestCount: "200-300",
    eventDateApprox: "2026-12-10",
    meetingChannel: "video",
    slotId: validSlotId,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/consultations/slots", () => {
    it("returns HTTP 200 with available slots and mandatory Cache-Control: no-store, private header", async () => {
      vi.spyOn(consultationBookingService, "getAvailableSlots").mockResolvedValueOnce([
        {
          id: validSlotId,
          startTime: "2026-09-17T04:30:00.000Z",
          endTime: "2026-09-17T05:30:00.000Z",
        },
      ]);

      const request = new NextRequest("http://localhost:3000/api/consultations/slots", {
        method: "GET",
        headers: {
          "x-real-ip": "198.51.100.20",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.slots).toHaveLength(1);
      expect(data.data.slots[0]).toEqual({
        id: validSlotId,
        startTime: "2026-09-17T04:30:00.000Z",
        endTime: "2026-09-17T05:30:00.000Z",
      });

      // Mandatory Cache-Control header
      expect(response.headers.get("Cache-Control")).toBe("no-store, private");
      expect(response.headers.get("X-Request-Id")).toBeTruthy();

      // Ensure reservationToken is strictly absent from GET response
      expect((data.data.slots[0] as Record<string, unknown>).reservationToken).toBeUndefined();
      expect((data.data.slots[0] as Record<string, unknown>).reservation_token).toBeUndefined();
    });

    it("rejects cross-origin requests with HTTP 403", async () => {
      const request = new NextRequest("http://localhost:3000/api/consultations/slots", {
        method: "GET",
        headers: {
          host: "localhost:3000",
          origin: "https://evil-cross-site.com",
          "sec-fetch-site": "cross-site",
          "x-real-ip": "198.51.100.21",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Cross-origin request blocked.");
      expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    });

    it("enforces rate limit of 30 requests per minute on isolated IP", async () => {
      vi.spyOn(consultationBookingService, "getAvailableSlots").mockResolvedValue([]);

      const isolatedIp = "198.51.100.77";

      for (let i = 0; i < 30; i++) {
        const req = new NextRequest("http://localhost:3000/api/consultations/slots", {
          method: "GET",
          headers: { "x-real-ip": isolatedIp },
        });
        const res = await GET(req);
        expect(res.status).toBe(200);
      }

      // 31st request triggers HTTP 429
      const blockedReq = new NextRequest("http://localhost:3000/api/consultations/slots", {
        method: "GET",
        headers: { "x-real-ip": isolatedIp },
      });
      const blockedRes = await GET(blockedReq);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    });

    it("returns HTTP 400 when query date parameters are malformed", async () => {
      vi.spyOn(consultationBookingService, "getAvailableSlots").mockRejectedValueOnce(
        new Error("Invalid startDate format")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/consultations/slots?startDate=malformed-date",
        {
          method: "GET",
          headers: { "x-real-ip": "198.51.100.22" },
        }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("Invalid startDate format");
    });
  });

  describe("POST /api/consultations/reserve", () => {
    it("returns HTTP 200 with reservation token, consultationId, and expiry upon successful reservation", async () => {
      vi.spyOn(consultationBookingService, "reserveSlot").mockResolvedValueOnce({
        success: true,
        consultationId: "cns-uuid-101",
        slotId: validSlotId,
        reservationToken: "abc123token456longsecret789",
        reservedUntil: "2026-09-17T05:15:00.000Z",
        expiresInSeconds: 900,
      });

      const request = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.30",
        },
        body: JSON.stringify(getValidReservePayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        consultationId: "cns-uuid-101",
        slotId: validSlotId,
        reservationToken: "abc123token456longsecret789",
        reservedUntil: "2026-09-17T05:15:00.000Z",
        expiresInSeconds: 900,
      });
      expect(response.headers.get("X-Request-Id")).toBeTruthy();
    });

    it("rejects cross-origin submissions with HTTP 403", async () => {
      const reserveSpy = vi.spyOn(consultationBookingService, "reserveSlot");

      const request = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          host: "localhost:3000",
          origin: "https://unauthorized-booking-bot.com",
          "sec-fetch-site": "cross-site",
          "x-real-ip": "198.51.100.31",
        },
        body: JSON.stringify(getValidReservePayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(reserveSpy).not.toHaveBeenCalled();
    });

    it("returns HTTP 413 when payload exceeds 50 KB ceiling", async () => {
      const reserveSpy = vi.spyOn(consultationBookingService, "reserveSlot");

      const request = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "60000",
          "x-real-ip": "198.51.100.32",
        },
        body: JSON.stringify(getValidReservePayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(413);
      expect(data.success).toBe(false);
      expect(reserveSpy).not.toHaveBeenCalled();
    });

    it("returns HTTP 400 when input validation fails (e.g. invalid phone)", async () => {
      const reserveSpy = vi.spyOn(consultationBookingService, "reserveSlot");

      const invalidPayload = {
        ...getValidReservePayload(),
        customerPhone: "12345", // Invalid phone
      };

      const request = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.33",
        },
        body: JSON.stringify(invalidPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(reserveSpy).not.toHaveBeenCalled();
    });

    it("returns HTTP 400 when slotId is missing from reservation request", async () => {
      const reserveSpy = vi.spyOn(consultationBookingService, "reserveSlot");

      const noSlotPayload = {
        ...getValidReservePayload(),
        slotId: null,
      };

      const request = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.34",
        },
        body: JSON.stringify(noSlotPayload),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("select an available consultation slot");
      expect(reserveSpy).not.toHaveBeenCalled();
    });

    it("enforces rate limit of 5 requests per 10 minutes on isolated IP", async () => {
      vi.spyOn(consultationBookingService, "reserveSlot").mockResolvedValue({
        success: true,
        consultationId: "cns-1",
        slotId: validSlotId,
        reservationToken: "tok-1",
        reservedUntil: "2026-09-17T05:15:00.000Z",
        expiresInSeconds: 900,
      });

      const isolatedIp = "198.51.100.88";

      for (let i = 0; i < 5; i++) {
        const req = new NextRequest("http://localhost:3000/api/consultations/reserve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-real-ip": isolatedIp,
          },
          body: JSON.stringify(getValidReservePayload()),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
      }

      // 6th request should trigger HTTP 429
      const blockedReq = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": isolatedIp,
        },
        body: JSON.stringify(getValidReservePayload()),
      });
      const blockedRes = await POST(blockedReq);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    });

    it("maps SLOT_UNAVAILABLE to HTTP 409", async () => {
      vi.spyOn(consultationBookingService, "reserveSlot").mockResolvedValueOnce({
        success: false,
        error: "SLOT_UNAVAILABLE",
        message: "This consultation slot is no longer available. Please choose another time.",
      });

      const request = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.35",
        },
        body: JSON.stringify(getValidReservePayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.message).toContain("no longer available");
    });

    it("maps SLOT_PAST_LEAD_TIME to HTTP 400", async () => {
      vi.spyOn(consultationBookingService, "reserveSlot").mockResolvedValueOnce({
        success: false,
        error: "SLOT_PAST_LEAD_TIME",
        message: "Consultations must be scheduled at least 24 hours in advance.",
      });

      const request = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.36",
        },
        body: JSON.stringify(getValidReservePayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain("24 hours in advance");
    });

    it("maps INVALID_SLOT to HTTP 404", async () => {
      vi.spyOn(consultationBookingService, "reserveSlot").mockResolvedValueOnce({
        success: false,
        error: "INVALID_SLOT",
        message: "The requested consultation slot was not found.",
      });

      const request = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.37",
        },
        body: JSON.stringify(getValidReservePayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.message).toContain("not found");
    });

    it("maps DATABASE_ERROR to HTTP 500 without leaking stack traces or internal errors", async () => {
      vi.spyOn(consultationBookingService, "reserveSlot").mockResolvedValueOnce({
        success: false,
        error: "DATABASE_ERROR",
        message: "Unable to create your consultation record. Please try again.",
      });

      const request = new NextRequest("http://localhost:3000/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-real-ip": "198.51.100.38",
        },
        body: JSON.stringify(getValidReservePayload()),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toBe("Unable to create your consultation record. Please try again.");
      expect(data.stack).toBeUndefined();
      expect(data.details).toBeUndefined();
    });
  });
});
