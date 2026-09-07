import { describe, it, expect } from "vitest";
import {
  sanitizeCsvCell,
  buildVendorCsvContent,
  sanitizeEmailForMailto,
  sanitizeExternalUrl,
  cleanIndianPhone,
  formatDisplayDate,
} from "../vendor-helpers";
import { AdminVendorItem } from "@/lib/backend/services/admin-vendor-service";

describe("Vendor Presentation & Security Helpers Suite", () => {
  describe("CSV Formula Neutralization & Escaping (sanitizeCsvCell)", () => {
    it("neutralizes =formula prefix with leading apostrophe", () => {
      expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
      expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    });

    it("neutralizes +formula prefix with leading apostrophe", () => {
      expect(sanitizeCsvCell("+1+1")).toBe("'+1+1");
    });

    it("neutralizes -formula prefix with leading apostrophe", () => {
      expect(sanitizeCsvCell("-2+5")).toBe("'-2+5");
    });

    it("neutralizes @formula prefix with leading apostrophe", () => {
      expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
      // When comma is present, RFC 4180 wraps cell in double quotes
      expect(sanitizeCsvCell("@SUM(1,2)")).toBe('"\'@SUM(1,2)"');
    });

    it("neutralizes dangerous prefix after leading whitespace or control characters", () => {
      expect(sanitizeCsvCell("   =CMD('calc')")).toBe("'   =CMD('calc')");
      expect(sanitizeCsvCell("\t+12345")).toBe("'\t+12345");
      // When newlines are present, RFC 4180 wraps cell in double quotes
      expect(sanitizeCsvCell("\r\n@malicious")).toBe('"\'\r\n@malicious"');
    });


    it("does NOT alter normal email addresses containing @ in the middle", () => {
      expect(sanitizeCsvCell("info@royaldecor.in")).toBe("info@royaldecor.in");
      expect(sanitizeCsvCell("contact@studio.co.in")).toBe("contact@studio.co.in");
    });

    it("does NOT alter normal hyphenated values where hyphen is not the first character", () => {
      expect(sanitizeCsvCell("Jaipur-Crafts")).toBe("Jaipur-Crafts");
      expect(sanitizeCsvCell("3–5 Years")).toBe("3–5 Years");
    });

    it("escapes double quotes by doubling them and wrapping in quotes", () => {
      expect(sanitizeCsvCell('Royal "Grand" Mandap')).toBe('"Royal ""Grand"" Mandap"');
    });

    it("wraps cells containing commas in double quotes", () => {
      expect(sanitizeCsvCell("Decor, Catering, Music")).toBe('"Decor, Catering, Music"');
    });

    it("wraps cells containing newlines in double quotes", () => {
      expect(sanitizeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });

    it("preserves Unicode characters intact", () => {
      expect(sanitizeCsvCell("रॉयल मंडप")).toBe("रॉयल मंडप");
      expect(sanitizeCsvCell("₹1,00,000")).toBe('"₹1,00,000"');
    });
  });

  describe("CSV Content Builder (buildVendorCsvContent)", () => {
    it("exports strictly the 9 approved columns and neutralizes formula injection across full dataset", () => {
      const mockVendors: AdminVendorItem[] = [
        {
          id: "secret-uuid-1", // Must NOT be in CSV
          businessName: "=SUM(1,1)", // Formula injection attempt
          contactName: "Rajesh Kumar",
          phone: "9876543210",
          email: "rajesh@decor.in",
          city: "Delhi, NCR", // Contains comma
          experience: "5–10 Years",
          portfolioUrl: "https://instagram.com/rajesh",
          categories: ["Decor & Styling", "Catering & Live Food"],
          createdAt: "2026-09-07T10:00:00.000Z",
          requestId: "internal-req-1", // Must NOT be in CSV
        },
      ];

      const csv = buildVendorCsvContent(mockVendors);
      const lines = csv.split("\r\n");

      // Verify Header
      expect(lines[0]).toBe(
        "Business Name,Contact Name,Phone,Email,City,Categories,Experience,Portfolio URL,Applied Date"
      );

      // Verify Data Row: secret-uuid-1 and internal-req-1 must NOT appear
      expect(csv).not.toContain("secret-uuid-1");
      expect(csv).not.toContain("internal-req-1");

      // Formula injection neutralized
      expect(lines[1]).toContain("'=SUM(1,1)");
      // Comma in city wrapped
      expect(lines[1]).toContain('"Delhi, NCR"');
      // Categories joined and wrapped
      expect(lines[1]).toContain('"Decor & Styling, Catering & Live Food"');
    });
  });

  describe("Email Sanitization (sanitizeEmailForMailto)", () => {
    it("accepts valid email address cleanly", () => {
      expect(sanitizeEmailForMailto("partner@eventsika.in")).toBe("partner@eventsika.in");
      expect(sanitizeEmailForMailto("contact.us@studio-lens.co.in")).toBe("contact.us@studio-lens.co.in");
    });

    it("trims surrounding whitespace on valid email", () => {
      expect(sanitizeEmailForMailto("   hello@domain.com  ")).toBe("hello@domain.com");
    });

    it("rejects emails containing carriage return (CR) to prevent header injection", () => {
      expect(sanitizeEmailForMailto("victim@domain.com\rbcc:attacker@evil.com")).toBeNull();
    });

    it("rejects emails containing line feed (LF) to prevent header injection", () => {
      expect(sanitizeEmailForMailto("victim@domain.com\nbcc:attacker@evil.com")).toBeNull();
      expect(sanitizeEmailForMailto("victim@domain.com\r\nbcc:attacker@evil.com")).toBeNull();
    });

    it("rejects emails containing null bytes or control characters", () => {
      expect(sanitizeEmailForMailto("victim@domain.com\x00extra")).toBeNull();
      expect(sanitizeEmailForMailto("victim@domain.com\x1b")).toBeNull();
    });

    it("rejects malformed email addresses", () => {
      expect(sanitizeEmailForMailto("not-an-email")).toBeNull();
      expect(sanitizeEmailForMailto("missing-domain@")).toBeNull();
      expect(sanitizeEmailForMailto("@missing-user.com")).toBeNull();
      expect(sanitizeEmailForMailto("spaces in@email.com")).toBeNull();
      expect(sanitizeEmailForMailto("")).toBeNull();
    });
  });

  describe("External Portfolio URL Sanitization (sanitizeExternalUrl)", () => {
    it("allows valid https: URL", () => {
      expect(sanitizeExternalUrl("https://instagram.com/royalmandap")).toBe("https://instagram.com/royalmandap");
      expect(sanitizeExternalUrl("https://myportfolio.com/gallery")).toBe("https://myportfolio.com/gallery");
    });

    it("allows valid http: URL", () => {
      expect(sanitizeExternalUrl("http://caterers.in")).toBe("http://caterers.in/");
    });

    it("blocks javascript: URL scheme", () => {
      expect(sanitizeExternalUrl("javascript:alert(document.cookie)")).toBeNull();
      expect(sanitizeExternalUrl("JAVASCRIPT:alert(1)")).toBeNull();
    });

    it("blocks data: URL scheme", () => {
      expect(sanitizeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    });

    it("blocks file: URL scheme", () => {
      expect(sanitizeExternalUrl("file:///etc/passwd")).toBeNull();
    });

    it("blocks vbscript: and arbitrary protocols", () => {
      expect(sanitizeExternalUrl("vbscript:msgbox(1)")).toBeNull();
      expect(sanitizeExternalUrl("blob:https://example.com/uuid")).toBeNull();
    });

    it("blocks malformed or empty strings", () => {
      expect(sanitizeExternalUrl("not a url")).toBeNull();
      expect(sanitizeExternalUrl("")).toBeNull();
      expect(sanitizeExternalUrl("   ")).toBeNull();
    });
  });

  describe("Phone and Date Helpers", () => {
    it("extracts 10 numerical digits from varied phone formats", () => {
      expect(cleanIndianPhone("9876543210")).toBe("9876543210");
      expect(cleanIndianPhone("+91 98765 43210")).toBe("9876543210");
      expect(cleanIndianPhone("09876543210")).toBe("9876543210");
    });

    it("formats ISO date string into readable Indian English date", () => {
      const formatted = formatDisplayDate("2026-09-07T12:00:00.000Z");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("Sep");
    });
  });
});
