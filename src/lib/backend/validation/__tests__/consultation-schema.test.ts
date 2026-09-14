import { describe, it, expect } from "vitest";
import { validateConsultationInput } from "../consultation-schema";

describe("validateConsultationInput Suite", () => {
  const validPayload = {
    customerFirstName: "Aarav",
    customerLastName: "Sharma",
    customerPhone: "9876543210",
    customerEmail: "aarav.sharma@example.com",
    customerCity: "Delhi",
    eventType: "Diwali Special",
    meetingChannel: "phone",
  };

  it("successfully validates a complete valid payload", () => {
    const result = validateConsultationInput(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerFirstName).toBe("Aarav");
      expect(result.data.customerLastName).toBe("Sharma");
      expect(result.data.customerPhone).toBe("9876543210");
      expect(result.data.customerEmail).toBe("aarav.sharma@example.com");
      expect(result.data.customerCity).toBe("Delhi");
      expect(result.data.eventType).toBe("Diwali Special");
      expect(result.data.meetingChannel).toBe("phone");
      expect(result.data.slotId).toBeNull();
      expect(result.data.eventTypeOther).toBeNull();
      expect(result.data.guestCount).toBeNull();
      expect(result.data.eventDateApprox).toBeNull();
    }
  });

  it("validates optional fields when provided", () => {
    const result = validateConsultationInput({
      ...validPayload,
      eventTypeOther: "Rooftop Diwali celebration",
      guestCount: "30–50 guests",
      eventDateApprox: "Mid November 2026",
      meetingChannel: "video",
      slotId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventTypeOther).toBe("Rooftop Diwali celebration");
      expect(result.data.guestCount).toBe("30–50 guests");
      expect(result.data.eventDateApprox).toBe("Mid November 2026");
      expect(result.data.meetingChannel).toBe("video");
      expect(result.data.slotId).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    }
  });

  it("rejects non-object or null payload", () => {
    expect(validateConsultationInput(null).success).toBe(false);
    expect(validateConsultationInput("invalid").success).toBe(false);
    expect(validateConsultationInput([]).success).toBe(false);
  });

  it("rejects missing or blank customerFirstName", () => {
    const result = validateConsultationInput({ ...validPayload, customerFirstName: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("first name");
    }
  });

  it("rejects customerFirstName exceeding 60 characters", () => {
    const result = validateConsultationInput({
      ...validPayload,
      customerFirstName: "A".repeat(61),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("exceed 60 characters");
    }
  });

  it("rejects missing or blank customerLastName", () => {
    const result = validateConsultationInput({ ...validPayload, customerLastName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("last name");
    }
  });

  it("normalizes and accepts +91 prefixed valid Indian phone numbers", () => {
    const result = validateConsultationInput({ ...validPayload, customerPhone: "+91 98765 43210" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerPhone).toBe("9876543210");
    }
  });

  it("rejects invalid Indian mobile numbers", () => {
    const result = validateConsultationInput({ ...validPayload, customerPhone: "1234567890" });
    expect(result.success).toBe(false);
  });

  it("rejects malformed email addresses", () => {
    const result = validateConsultationInput({ ...validPayload, customerEmail: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("valid email address");
    }
  });

  it("normalizes email address to lowercase", () => {
    const result = validateConsultationInput({ ...validPayload, customerEmail: "Aarav.Sharma@EXAMPLE.COM" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerEmail).toBe("aarav.sharma@example.com");
    }
  });

  it("rejects missing customerCity", () => {
    const result = validateConsultationInput({ ...validPayload, customerCity: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("city");
    }
  });

  it("rejects invalid meeting channels", () => {
    const result = validateConsultationInput({ ...validPayload, meetingChannel: "in_person" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Phone or Video");
    }
  });

  it("rejects malformed slotId that is not a valid UUID", () => {
    const result = validateConsultationInput({ ...validPayload, slotId: "not-a-uuid-1234" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("slot identifier format");
    }
  });
});
