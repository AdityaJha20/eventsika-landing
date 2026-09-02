import { describe, it, expect } from "vitest";
import { validateVendorInput } from "../vendor-schema";
import { VENDOR_CATEGORIES, VENDOR_EXPERIENCE_TIERS } from "../../constants/allowlists";

describe("validateVendorInput", () => {
  const getValidVendorPayload = () => ({
    businessName: "Royal Floral Decors",
    contactName: "Vikram Sharma",
    phone: "9876543210",
    email: "vikram@royalflorals.in",
    city: "Delhi",
    experience: "3–5 Years",
    portfolioUrl: "https://instagram.com/royalfloraldecors",
    categories: ["Decor & Styling", "Photography & Films"],
  });

  describe("Happy paths", () => {
    it("validates and normalizes a complete valid vendor application", () => {
      const payload = getValidVendorPayload();
      const result = validateVendorInput(payload);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.businessName).toBe("Royal Floral Decors");
        expect(result.data.contactName).toBe("Vikram Sharma");
        expect(result.data.phone).toBe("9876543210");
        expect(result.data.email).toBe("vikram@royalflorals.in");
        expect(result.data.city).toBe("Delhi");
        expect(result.data.experience).toBe("3–5 Years");
        expect(result.data.portfolioUrl).toBe("https://instagram.com/royalfloraldecors");
        expect(result.data.categories).toEqual(["Decor & Styling", "Photography & Films"]);
        expect(result.data.isBot).toBe(false);
      }
    });

    it("lowercases email address and trims whitespace", () => {
      const payload = {
        ...getValidVendorPayload(),
        email: "   VIKRAM@RoyalFlorals.IN   ",
      };
      const result = validateVendorInput(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("vikram@royalflorals.in");
      }
    });

    it("defaults to 3–5 Years if experience is omitted", () => {
      const payload = {
        ...getValidVendorPayload(),
        experience: undefined,
      };
      const result = validateVendorInput(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.experience).toBe("3–5 Years");
      }
    });

    it("accepts all canonical categories and experience tiers", () => {
      for (const tier of VENDOR_EXPERIENCE_TIERS) {
        const result = validateVendorInput({ ...getValidVendorPayload(), experience: tier });
        expect(result.success).toBe(true);
      }
      for (const cat of VENDOR_CATEGORIES) {
        const result = validateVendorInput({ ...getValidVendorPayload(), categories: [cat] });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Validation errors", () => {
    it("rejects invalid email formats", () => {
      const invalidEmails = ["notanemail", "test@", "@domain.com", "user@domain", "user space@domain.com"];
      for (const email of invalidEmails) {
        const result = validateVendorInput({ ...getValidVendorPayload(), email });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain("email");
        }
      }
    });

    it("rejects unrecognized partner categories", () => {
      const result = validateVendorInput({
        ...getValidVendorPayload(),
        categories: ["Astronaut Training"],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unrecognized partner category");
      }
    });

    it("rejects missing business name or contact name", () => {
      expect(validateVendorInput({ ...getValidVendorPayload(), businessName: "" }).success).toBe(false);
      expect(validateVendorInput({ ...getValidVendorPayload(), contactName: "" }).success).toBe(false);
    });

    it("rejects missing operating city", () => {
      expect(validateVendorInput({ ...getValidVendorPayload(), city: "" }).success).toBe(false);
    });
  });

  describe("Security and bot protection", () => {
    it("detects honeypot bots and flags isBot: true", () => {
      const payload = {
        ...getValidVendorPayload(),
        honeypot: "automated_spam",
      };
      const result = validateVendorInput(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isBot).toBe(true);
      }
    });
  });
});
