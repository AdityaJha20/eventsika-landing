import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  buildEstimatePdf,
  buildEstimatePdfModel,
  ESTIMATE_PAGE_DISCLAIMER,
  estimatePdfFilename,
} from "@/lib/estimate-pdf";
import {
  calculatePackageEstimate,
  formatCurrency,
  OPTIONAL_SERVICES_CONFIG,
  type OptionalServiceId,
} from "@/lib/packages-config";
import {
  CONSULTATION_HREF,
  hasSubmittedLead,
  LEAD_COMPLETION_KEY,
  markLeadSubmitted,
} from "@/lib/lead-completion";

const assets = {
  bodyFont: readFileSync(path.resolve("public/fonts/Inter.ttf")),
  displayFont: readFileSync(path.resolve("public/fonts/PlayfairDisplay.ttf")),
  logoPng: readFileSync(path.resolve("public/images/eventsika-official-logo.png")),
};
const DATE = new Date("2026-11-18T06:00:00.000Z");

describe("estimate PDF model", () => {
  it("matches the on-screen calculation with no add-ons", () => {
    const model = buildEstimatePdfModel({ tierId: "premium", guestCount: 25, serviceIds: [] }, DATE);
    expect(model.packageName).toBe("Premium");
    expect(model.guests).toBe("25");
    expect(model.date).toBe("18 November 2026");
    expect(model.includes).toBe("Decor only");
    expect(model.rows).toEqual([
      { item: "Premium Decor Package", note: "Includes decor only", rate: "₹2,000 / person", guests: "25", subtotal: "₹50,000" },
    ]);
    expect(model.hasServices).toBe(false);
    expect(model.totals[1]).toEqual({ label: "Selected services subtotal", value: "None selected" });
    expect(model.grandTotal.value).toBe("₹50,000");
    expect(model.disclaimer).toBe(ESTIMATE_PAGE_DISCLAIMER);
    expect(model.contact).toContain("care@eventsika.in");
  });

  it("itemises every selected service at the tier rate", () => {
    const serviceIds: OptionalServiceId[] = ["food", "photography", "valet"];
    const model = buildEstimatePdfModel({ tierId: "luxury", guestCount: 60, serviceIds }, DATE);
    const estimate = calculatePackageEstimate(60, "luxury", serviceIds);
    expect(model.rows).toHaveLength(4);
    for (const id of serviceIds) {
      const service = OPTIONAL_SERVICES_CONFIG.find((s) => s.id === id)!;
      const row = model.rows.find((r) => r.item === service.name)!;
      expect(row.rate).toBe(`${formatCurrency(service.ratesPerPerson.luxury)} / person`);
      expect(row.subtotal).toBe(formatCurrency(service.ratesPerPerson.luxury * 60));
    }
    expect(model.totals[0].value).toBe(formatCurrency(estimate.packageSubtotal));
    expect(model.totals[1].value).toBe(formatCurrency(estimate.servicesSubtotal));
    expect(model.grandTotal.value).toBe(formatCurrency(estimate.total));
  });

  it("names the file after the package and guest count", () => {
    expect(estimatePdfFilename({ tierId: "premium", guestCount: 25, serviceIds: [] })).toBe(
      "Eventsika-Estimate-Premium-25-Guests.pdf",
    );
  });
});

describe("estimate PDF document", () => {
  it("produces a valid one-page A4 PDF with embedded fonts", async () => {
    const bytes = await buildEstimatePdf(
      buildEstimatePdfModel({ tierId: "premium", guestCount: 25, serviceIds: ["food"] }, DATE),
      assets,
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    doc.registerFontkit(fontkit);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
    expect(doc.getTitle()).toContain("Premium, 25 guests");
  });

  it("flows onto more pages when the breakdown is long", async () => {
    const model = buildEstimatePdfModel(
      { tierId: "luxury", guestCount: 120, serviceIds: OPTIONAL_SERVICES_CONFIG.map((s) => s.id) },
      DATE,
    );
    // Stretch the table well past one page to exercise pagination.
    const long = { ...model, rows: Array.from({ length: 5 }, () => model.rows).flat() };
    const doc = await PDFDocument.load(await buildEstimatePdf(long, assets));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});

describe("lead completion marker", () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
  }

  it("is absent until a confirmed submission marks it", () => {
    const storage = memoryStorage();
    expect(hasSubmittedLead(storage)).toBe(false);
    markLeadSubmitted(storage);
    expect(hasSubmittedLead(storage)).toBe(true);
  });

  it("stores only a flag, no personal data", () => {
    const storage = memoryStorage();
    markLeadSubmitted(storage);
    expect([...storage.data.entries()]).toEqual([[LEAD_COMPLETION_KEY, "1"]]);
  });

  it("treats blocked storage as not submitted", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => markLeadSubmitted(broken)).not.toThrow();
    expect(hasSubmittedLead(broken)).toBe(false);
  });

  it("sends completed visitors to the existing consultation route", () => {
    expect(CONSULTATION_HREF).toBe("/diwali-consultation");
  });

  it("is set by the hero form only after the API confirms success", () => {
    const hero = readFileSync(path.resolve("src/components/Hero.tsx"), "utf8");
    const failureCheck = hero.indexOf("if (!res.ok || !data?.success)");
    const mark = hero.indexOf("markLeadSubmitted();");
    expect(failureCheck).toBeGreaterThan(-1);
    expect(mark).toBeGreaterThan(failureCheck);
    expect(hero.match(/markLeadSubmitted\(\)/g)).toHaveLength(1);
  });
});
