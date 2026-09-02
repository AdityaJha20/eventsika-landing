import { describe, it, expect } from "vitest";
import { validateLeadInput } from "../lead-schema";
import {
  CITY_OPTIONS,
  EVENT_TYPE_OPTIONS,
  GUEST_COUNT_OPTIONS,
  VENUE_TYPE_OPTIONS,
  BUDGET_OPTIONS,
} from "../../constants/allowlists";

describe("validateLeadInput", () => {
  const getFutureDateString = (daysAhead = 30): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getValidPayload = () => ({
    userName: "Ananya Roy",
    userPhone: "9876543210",
    city: "Delhi",
    eventType: "Birthday",
    eventDate: getFutureDateString(45),
    guestCount: "30–50 guests",
    venueType: "Indoor",
    selectedServices: ["Decor & Styling", "Photography & Films"],
    budgetRange: "₹50,000 – ₹1,00,000",
    whatsappConsent: true,
  });

  describe("Happy paths", () => {
    it("successfully validates and normalizes a complete valid celebration lead", () => {
      const payload = getValidPayload();
      const result = validateLeadInput(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userName).toBe("Ananya Roy");
        expect(result.data.userPhone).toBe("9876543210");
        expect(result.data.city).toBe("Delhi");
        expect(result.data.eventType).toBe("Birthday");
        expect(result.data.eventDate).toBe(payload.eventDate);
        expect(result.data.guestCount).toBe("30–50 guests");
        expect(result.data.venueType).toBe("Indoor");
        expect(result.data.selectedServices).toEqual(["Decor & Styling", "Photography & Films"]);
        expect(result.data.budgetRange).toBe("₹50,000 – ₹1,00,000");
        expect(result.data.whatsappConsent).toBe(true);
        expect(result.data.isBot).toBe(false);
      }
    });

    it("accepts all canonical options defined in allowlists", () => {
      for (const city of CITY_OPTIONS) {
        const result = validateLeadInput({ ...getValidPayload(), city });
        expect(result.success).toBe(true);
      }
      for (const eventType of EVENT_TYPE_OPTIONS) {
        const result = validateLeadInput({ ...getValidPayload(), eventType });
        expect(result.success).toBe(true);
      }
      for (const guestCount of GUEST_COUNT_OPTIONS) {
        const result = validateLeadInput({ ...getValidPayload(), guestCount });
        expect(result.success).toBe(true);
      }
      for (const venueType of VENUE_TYPE_OPTIONS) {
        const result = validateLeadInput({ ...getValidPayload(), venueType });
        expect(result.success).toBe(true);
      }
      for (const budgetRange of BUDGET_OPTIONS) {
        const result = validateLeadInput({ ...getValidPayload(), budgetRange });
        expect(result.success).toBe(true);
      }
    });

    it("deduplicates redundant items in selectedServices", () => {
      const payload = {
        ...getValidPayload(),
        selectedServices: ["Decor & Styling", "Decor & Styling", "Food & Catering"],
      };
      const result = validateLeadInput(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.selectedServices).toEqual(["Decor & Styling", "Food & Catering"]);
      }
    });
  });

  describe("Allowlist bypass and validation errors", () => {
    it("rejects invalid city selections", () => {
      const result = validateLeadInput({ ...getValidPayload(), city: "Atlantis" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Invalid city selection");
      }
    });

    it("rejects invalid event occasions", () => {
      const result = validateLeadInput({ ...getValidPayload(), eventType: "SpaceParty" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("valid event occasion");
      }
    });

    it("rejects unknown services", () => {
      const result = validateLeadInput({ ...getValidPayload(), selectedServices: ["Helicopter Tour"] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unknown service requested");
      }
    });

    it("rejects empty selectedServices array", () => {
      const result = validateLeadInput({ ...getValidPayload(), selectedServices: [] });
      expect(result.success).toBe(false);
    });

    it("rejects missing WhatsApp consent", () => {
      const result = validateLeadInput({ ...getValidPayload(), whatsappConsent: false });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("WhatsApp");
      }
    });

    it("rejects name exceeding 100 characters", () => {
      const result = validateLeadInput({ ...getValidPayload(), userName: "A".repeat(101) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("100 characters");
      }
    });

    it("rejects non-object or null request payload", () => {
      expect(validateLeadInput(null).success).toBe(false);
      expect(validateLeadInput(undefined).success).toBe(false);
      expect(validateLeadInput("string").success).toBe(false);
      expect(validateLeadInput([1, 2, 3]).success).toBe(false);
    });
  });

  describe("Security and parameter pollution", () => {
    it("identifies honeypot bot submissions without erroring out", () => {
      const payload = {
        ...getValidPayload(),
        honeypot: "spambot_field_filled",
      };
      const result = validateLeadInput(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isBot).toBe(true);
      }
    });

    it("discards client-injected trusted fields (id, created_at, status, role)", () => {
      const payload = {
        ...getValidPayload(),
        id: "injected-admin-uuid",
        created_at: "2000-01-01T00:00:00Z",
        status: "APPROVED_SUPERUSER",
        role: "admin",
      };
      const result = validateLeadInput(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        // Assert that the returned object contains only the canonical fields
        expect((result.data as unknown as Record<string, unknown>).id).toBeUndefined();
        expect((result.data as unknown as Record<string, unknown>).created_at).toBeUndefined();
        expect((result.data as unknown as Record<string, unknown>).status).toBeUndefined();
        expect((result.data as unknown as Record<string, unknown>).role).toBeUndefined();
      }
    });
  });
});
