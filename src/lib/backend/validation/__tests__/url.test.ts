import { describe, it, expect } from "vitest";
import { validatePortfolioUrl } from "../url";

describe("validatePortfolioUrl", () => {
  describe("Valid URLs and profile handles", () => {
    it("accepts valid full HTTPS URLs", () => {
      const valid = [
        "https://instagram.com/eventsika_decor",
        "https://www.eventsika.in",
        "https://myportfolio.com/gallery/123",
        "https://behance.net/designers/delhi",
      ];
      for (const u of valid) {
        const result = validatePortfolioUrl(u);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBe(u);
        expect(result.error).toBeUndefined();
      }
    });

    it("accepts valid HTTP URLs", () => {
      const result = validatePortfolioUrl("http://example.com/portfolio");
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toBe("http://example.com/portfolio");
    });

    it("auto-prepends https:// to domain shorthands", () => {
      const shorthands = [
        ["instagram.com/eventsika", "https://instagram.com/eventsika"],
        ["www.mydecor.in", "https://www.mydecor.in"],
        ["facebook.com/caterers.delhi", "https://facebook.com/caterers.delhi"],
      ];
      for (const [input, expected] of shorthands) {
        const result = validatePortfolioUrl(input);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBe(expected);
      }
    });

    it("trims surrounding whitespace", () => {
      const result = validatePortfolioUrl("   https://instagram.com/eventsika   ");
      expect(result.isValid).toBe(true);
      expect(result.normalizedUrl).toBe("https://instagram.com/eventsika");
    });
  });

  describe("Security and invalid URLs", () => {
    it("rejects dangerous URL schemes (XSS/injection mitigation)", () => {
      const malicious = [
        "javascript:alert(document.cookie)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/passwd",
        "vbscript:msgbox(1)",
        "JAVASCRIPT:alert(1)",
      ];
      for (const m of malicious) {
        const result = validatePortfolioUrl(m);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it("rejects invalid domains without a TLD", () => {
      const invalid = ["instagram", "localhost", "http://localhost", "myportfolio"];
      for (const inv of invalid) {
        const result = validatePortfolioUrl(inv);
        expect(result.isValid).toBe(false);
      }
    });

    it("rejects URLs exceeding 300 characters", () => {
      const longUrl = "https://instagram.com/" + "a".repeat(300);
      const result = validatePortfolioUrl(longUrl);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("exceed 300 characters");
    });

    it("rejects empty string, whitespace, and non-string values", () => {
      expect(validatePortfolioUrl("").isValid).toBe(false);
      expect(validatePortfolioUrl("   ").isValid).toBe(false);
      expect(validatePortfolioUrl(null).isValid).toBe(false);
      expect(validatePortfolioUrl(undefined).isValid).toBe(false);
      expect(validatePortfolioUrl(12345).isValid).toBe(false);
    });
  });
});
