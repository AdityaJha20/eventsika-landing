import { describe, it, expect } from "vitest";
import { validateEmail, MAX_EMAIL_LENGTH } from "../email";
import { sanitizePhoneInput, validateIndianPhone } from "../phone";
import { todayInIndia, validateEventDate } from "../date";
import { validateLeadInput } from "../lead-schema";

// 10:00 IST on 17 Nov 2026
const NOON_IST = new Date("2026-11-17T04:30:00.000Z");

describe("validateEmail", () => {
  it("accepts a valid address, trimming and lowercasing it", () => {
    expect(validateEmail("  Guest.Name@Example.COM ")).toEqual({
      isValid: true,
      normalizedEmail: "guest.name@example.com",
    });
  });

  it.each([undefined, null, 42, "", "   "])("rejects missing or non-string email %j", (input) => {
    const result = validateEmail(input);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("Please enter your email address.");
  });

  it.each(["guest", "guest@", "guest@example", "@example.com", "gu est@example.com"])(
    "rejects invalid format %s",
    (input) => {
      expect(validateEmail(input).isValid).toBe(false);
    }
  );

  it("rejects addresses longer than the maximum length", () => {
    const tooLong = `${"a".repeat(MAX_EMAIL_LENGTH - "@example.com".length + 1)}@example.com`;
    expect(validateEmail(tooLong).isValid).toBe(false);
    expect(validateEmail(tooLong.slice(1)).isValid).toBe(true);
  });
});

describe("sanitizePhoneInput", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["abcdef", ""],
    ["98a76b54c32d10", "9876543210"],
    ["+91 98765-43210", "+91 98765-43210"],
    ["call +91 (987) 654 3210!", " +91 (987) 654 3210"],
    ["98765#43210*", "9876543210"],
    ["", ""],
  ])("turns %j into %j", (input, expected) => {
    expect(sanitizePhoneInput(input)).toBe(expected);
  });

  it("keeps sanitized valid numbers acceptable to the server validator", () => {
    expect(validateIndianPhone(sanitizePhoneInput("+91 98765 43210")).normalizedPhone).toBe("9876543210");
    expect(validateIndianPhone(sanitizePhoneInput("98x76543210")).isValid).toBe(true);
  });

  it("still lets the server reject letters and malformed numbers", () => {
    expect(validateIndianPhone("98765abc10").isValid).toBe(false);
    expect(validateIndianPhone("12345").isValid).toBe(false);
  });
});

describe("event dates on the India calendar", () => {
  it("formats today in Asia/Kolkata as YYYY-MM-DD", () => {
    expect(todayInIndia(NOON_IST)).toBe("2026-11-17");
  });

  it("accepts today and tomorrow, rejects yesterday", () => {
    expect(validateEventDate("2026-11-17", NOON_IST).isValid).toBe(true);
    expect(validateEventDate("2026-11-18", NOON_IST).isValid).toBe(true);
    expect(validateEventDate("2026-11-16", NOON_IST)).toMatchObject({
      isValid: false,
      error: "Event date cannot be in the past.",
    });
  });

  it("uses the Indian date just after IST midnight, while UTC is still on the previous day", () => {
    const justAfterIstMidnight = new Date("2026-11-16T18:30:00.000Z"); // 00:00 IST, 17 Nov
    expect(todayInIndia(justAfterIstMidnight)).toBe("2026-11-17");
    expect(validateEventDate("2026-11-16", justAfterIstMidnight).isValid).toBe(false);
    expect(validateEventDate("2026-11-17", justAfterIstMidnight).isValid).toBe(true);
  });

  it("keeps the previous Indian date just before IST midnight", () => {
    const justBeforeIstMidnight = new Date("2026-11-16T18:29:59.000Z"); // 23:59:59 IST, 16 Nov
    expect(todayInIndia(justBeforeIstMidnight)).toBe("2026-11-16");
    expect(validateEventDate("2026-11-16", justBeforeIstMidnight).isValid).toBe(true);
  });

  it("still rejects invalid calendar dates and the 2-year limit", () => {
    expect(validateEventDate("2026-11-31", NOON_IST).isValid).toBe(false);
    expect(validateEventDate("2027-02-29", NOON_IST).isValid).toBe(false);
    expect(validateEventDate("2028-11-18", NOON_IST).isValid).toBe(false);
  });
});

describe("validateLeadInput hero enquiry fields", () => {
  const futureDate = (daysAhead: number) => {
    const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return todayInIndia(d);
  };

  const payload = (overrides: Record<string, unknown> = {}) => ({
    userName: "Test Guest",
    userPhone: "9876543210",
    userEmail: "guest@example.com",
    city: "Delhi",
    eventType: "Birthday",
    eventDate: futureDate(30),
    guestCount: "30–50 guests",
    venueType: "Indoor",
    selectedServices: ["Decor & Styling"],
    budgetRange: "₹50,000 – ₹1,00,000",
    whatsappConsent: true,
    emailConsent: true,
    ...overrides,
  });

  it("normalizes the email and records both consents when explicitly given", () => {
    const result = validateLeadInput(payload({ userEmail: "  Guest@Example.com " }));
    expect(result).toMatchObject({
      success: true,
      data: { userEmail: "guest@example.com", whatsappConsent: true, emailConsent: true },
    });
  });

  it.each([
    [{ userEmail: undefined }, "Please enter your email address."],
    [{ userEmail: 123 }, "Please enter your email address."],
    [{ userEmail: "not-an-email" }, "Please enter a valid email address."],
    [{ userEmail: `${"a".repeat(250)}@example.com` }, "Please enter a valid email address."],
  ])("rejects %j", (overrides, error) => {
    expect(validateLeadInput(payload(overrides))).toEqual({ success: false, error });
  });

  it("never infers email consent from WhatsApp consent or a supplied email", () => {
    for (const emailConsent of [undefined, false, "true", 1]) {
      const result = validateLeadInput(payload({ emailConsent }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.emailConsent).toBe(false);
    }
  });

  it("still requires contact consent", () => {
    expect(validateLeadInput(payload({ whatsappConsent: false }))).toEqual({
      success: false,
      error: "Please agree to be contacted on WhatsApp and Email to proceed.",
    });
  });

  it.each(["Christmas Celebration", "New Year Celebration"])("accepts event type %s", (eventType) => {
    expect(validateLeadInput(payload({ eventType })).success).toBe(true);
  });

  it("no longer accepts Diwali Special for new enquiries", () => {
    expect(validateLeadInput(payload({ eventType: "Diwali Special" })).success).toBe(false);
  });

  it("accepts venue type Other", () => {
    expect(validateLeadInput(payload({ venueType: "Other" })).success).toBe(true);
  });

  it("rejects a past event date submitted directly to the API", () => {
    expect(validateLeadInput(payload({ eventDate: futureDate(-1) }))).toEqual({
      success: false,
      error: "Event date cannot be in the past.",
    });
  });
});
