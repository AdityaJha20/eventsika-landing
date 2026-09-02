import { describe, it, expect } from "vitest";
import { validateIndianPhone } from "../phone";

describe("validateIndianPhone", () => {
  describe("Valid phone numbers", () => {
    it("accepts standard 10-digit Indian numbers starting with 6, 7, 8, 9", () => {
      const validNumbers = ["9876543210", "8123456789", "7000012345", "6987654321"];
      for (const num of validNumbers) {
        const result = validateIndianPhone(num);
        expect(result.isValid).toBe(true);
        expect(result.normalizedPhone).toBe(num);
        expect(result.error).toBeUndefined();
      }
    });

    it("normalizes +91 country code prefix to standard 10 digits", () => {
      const result = validateIndianPhone("+91 9876543210");
      expect(result.isValid).toBe(true);
      expect(result.normalizedPhone).toBe("9876543210");
    });

    it("normalizes 91 country code prefix without plus to standard 10 digits", () => {
      const result = validateIndianPhone("919876543210");
      expect(result.isValid).toBe(true);
      expect(result.normalizedPhone).toBe("9876543210");
    });

    it("normalizes leading 0 prefix to standard 10 digits", () => {
      const result = validateIndianPhone("09876543210");
      expect(result.isValid).toBe(true);
      expect(result.normalizedPhone).toBe("9876543210");
    });

    it("strips common formatting characters (spaces, hyphens, parentheses)", () => {
      const result = validateIndianPhone("+91 (98765) 432-10");
      expect(result.isValid).toBe(true);
      expect(result.normalizedPhone).toBe("9876543210");
    });

    it("trims surrounding whitespace", () => {
      const result = validateIndianPhone("   9876543210   ");
      expect(result.isValid).toBe(true);
      expect(result.normalizedPhone).toBe("9876543210");
    });
  });

  describe("Invalid phone numbers", () => {
    it("rejects numbers starting with invalid digits (0–5)", () => {
      const invalidNumbers = ["5876543210", "4123456789", "3000012345", "2987654321", "1987654321"];
      for (const num of invalidNumbers) {
        const result = validateIndianPhone(num);
        expect(result.isValid).toBe(false);
        expect(result.normalizedPhone).toBe("");
        expect(result.error).toBeDefined();
      }
    });

    it("rejects strings containing alphabetical characters", () => {
      const result = validateIndianPhone("98765abcde");
      expect(result.isValid).toBe(false);
      expect(result.normalizedPhone).toBe("");
      expect(result.error).toContain("invalid characters");
    });

    it("rejects strings containing special characters or punctuation", () => {
      const result = validateIndianPhone("98765@43210");
      expect(result.isValid).toBe(false);
      expect(result.normalizedPhone).toBe("");
    });

    it("rejects numbers that are too short", () => {
      const result = validateIndianPhone("98765");
      expect(result.isValid).toBe(false);
      expect(result.normalizedPhone).toBe("");
    });

    it("rejects numbers that are too long", () => {
      const result = validateIndianPhone("987654321098765");
      expect(result.isValid).toBe(false);
      expect(result.normalizedPhone).toBe("");
    });

    it("rejects empty string and whitespace-only strings", () => {
      const emptyResult = validateIndianPhone("");
      expect(emptyResult.isValid).toBe(false);
      expect(emptyResult.error).toContain("Please enter your phone number");

      const whitespaceResult = validateIndianPhone("   ");
      expect(whitespaceResult.isValid).toBe(false);
    });

    it("rejects non-string inputs", () => {
      expect(validateIndianPhone(null).isValid).toBe(false);
      expect(validateIndianPhone(undefined).isValid).toBe(false);
      expect(validateIndianPhone(9876543210).isValid).toBe(false);
      expect(validateIndianPhone({ phone: "9876543210" }).isValid).toBe(false);
    });
  });
});
