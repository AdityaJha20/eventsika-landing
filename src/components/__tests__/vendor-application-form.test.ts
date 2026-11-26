import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VendorApplicationForm from "@/components/VendorApplicationForm";
import { VENDOR_CATEGORIES } from "@/lib/backend/constants/allowlists";
import { validateVendorInput } from "@/lib/backend/validation/vendor-schema";

const REQUIRED_FIELDS = [
  "businessName",
  "contactName",
  "phone",
  "email",
  "city",
  "portfolioUrl",
] as const;

const valid = () => ({
  businessName: "Royal Floral Decors",
  contactName: "Vikram Sharma",
  phone: "9876543210",
  email: "vikram@royalflorals.in",
  city: "Delhi",
  experience: "3–5 Years",
  portfolioUrl: "instagram.com/royalfloraldecors",
  categories: ["Decor & Styling"],
});

function fieldErrors(payload: unknown) {
  const result = validateVendorInput(payload);
  return result.success ? {} : result.fieldErrors;
}

describe("vendor form markup (EVT-005/007)", () => {
  const html = renderToStaticMarkup(createElement(VendorApplicationForm));

  it.each(REQUIRED_FIELDS)("%s is truly required", (field) => {
    const tag = html.match(new RegExp(`<input[^>]*id="${field}"[^>]*>`))?.[0];
    expect(tag).toBeDefined();
    expect(tag).toMatch(/\srequired=""/);
  });

  it("every category checkbox has a stable name and allowlisted value", () => {
    const boxes = [...html.matchAll(/<input type="checkbox"[^>]*>/g)].map((m) => m[0]);
    expect(boxes).toHaveLength(6);
    const values = boxes.map((tag) => {
      expect(tag).toContain('name="categories"');
      return tag.match(/value="([^"]+)"/)?.[1].replace(/&amp;/g, "&");
    });
    expect(values).toEqual([...VENDOR_CATEGORIES]);
  });
});

describe("shared vendor validation (client + server)", () => {
  it("all empty: one error per required field and categories", () => {
    const errors = fieldErrors({
      businessName: "",
      contactName: "",
      phone: "",
      email: "",
      city: "",
      portfolioUrl: "",
      categories: [],
    });
    expect(Object.keys(errors)).toEqual([...REQUIRED_FIELDS, "categories"]);
  });

  it.each(REQUIRED_FIELDS)("missing only %s: exactly that field errors", (field) => {
    expect(Object.keys(fieldErrors({ ...valid(), [field]: "  " }))).toEqual([field]);
  });

  it.each([
    ["email", "vikram@", "valid email"],
    ["phone", "12345", "10-digit"],
    ["phone", "98765abc10", "invalid characters"],
    ["portfolioUrl", "not a url", "valid"],
    ["portfolioUrl", "javascript:alert(1)", "unsafe"],
  ])("invalid %s %j", (field, value, message) => {
    const errors = fieldErrors({ ...valid(), [field]: value });
    expect(Object.keys(errors)).toEqual([field]);
    expect(errors[field as keyof typeof errors]).toContain(message);
  });

  it("valid payload passes and is normalized", () => {
    const result = validateVendorInput(valid());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.portfolioUrl).toBe("https://instagram.com/royalfloraldecors");
  });

  describe("categories", () => {
    it("none selected is rejected", () => {
      expect(Object.keys(fieldErrors({ ...valid(), categories: [] }))).toEqual(["categories"]);
    });

    it("one, multiple and all six are accepted in order", () => {
      for (const categories of [
        ["Music & DJ"],
        ["Decor & Styling", "Pandit / Vedic Services"],
        [...VENDOR_CATEGORIES],
      ]) {
        const result = validateVendorInput({ ...valid(), categories });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.categories).toEqual(categories);
      }
    });

    it("an unknown value is rejected", () => {
      const errors = fieldErrors({ ...valid(), categories: ["Decor & Styling", "Fireworks"] });
      expect(errors.categories).toContain("Fireworks");
    });

    it("FormData-style serialization of checked boxes round-trips", () => {
      const form = new FormData();
      for (const cat of VENDOR_CATEGORIES) form.append("categories", cat);
      const result = validateVendorInput({ ...valid(), categories: form.getAll("categories") });
      expect(result.success && result.data.categories).toEqual([...VENDOR_CATEGORIES]);
    });
  });

  it("honeypot path still short-circuits as a bot", () => {
    const result = validateVendorInput({ honeypot: "spam" });
    expect(result.success && result.data.isBot).toBe(true);
  });
});
