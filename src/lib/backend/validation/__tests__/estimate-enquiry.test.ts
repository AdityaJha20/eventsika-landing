import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateLeadInput, type ValidatedLeadInput } from "../lead-schema";
import { SupabaseLeadRepository } from "../../repositories/supabase-lead-repository";
import { CelebrationEstimateCard } from "@/components/Hero";
import { calculatePackageEstimate } from "@/lib/packages-config";

function futureDate(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// What the homepage form sends when the visitor arrived from /estimate (Premium, 30 guests, two services).
const estimateEnquiry = (overrides: Record<string, unknown> = {}) => ({
  userName: "Test Guest",
  userPhone: "9876543210",
  userEmail: "guest@example.com",
  city: "Delhi",
  eventType: "Birthday",
  eventDate: futureDate(),
  guestCount: "30–50 guests",
  venueType: "Both",
  selectedServices: ["Decor & Styling", "Food & Catering", "Photography & Films"],
  budgetRange: "₹1,00,000 – ₹2,00,000",
  whatsappConsent: true,
  emailConsent: true,
  honeypot: "",
  packageTier: "premium",
  packageGuestCount: 30,
  packageVendorAddonIds: ["food", "photography"],
  ...overrides,
});

function saveWith(lead: ValidatedLeadInput) {
  const single = vi.fn().mockResolvedValue({
    data: { id: "lead-uuid-9", created_at: "2026-11-18T10:00:00.000Z" },
    error: null,
  });
  const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
  const repo = new SupabaseLeadRepository({ from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient);
  return { insert, saved: repo.saveLead(lead, { requestId: "req-test" }) };
}

describe("estimate-aware enquiry: server validation", () => {
  it("recalculates the estimate and builds a full snapshot from trusted pricing", () => {
    const result = validateLeadInput(estimateEnquiry());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const expected = calculatePackageEstimate(30, "premium", ["food", "photography"]);
    expect(result.data.packageQuote).toEqual({
      tierId: "premium",
      guestCount: 30,
      serviceIds: ["food", "photography"],
      packageSubtotalRupees: 60000,
      servicesSubtotalRupees: 100500,
      totalEstimateRupees: 160500,
      snapshot: {
        version: 1,
        packageId: "premium",
        packageName: "Premium",
        includes: "Decor only",
        guestCount: 30,
        decorRatePerPersonRupees: 2000,
        services: [
          { id: "food", name: "Food & catering", ratePerPersonRupees: 2600, subtotalRupees: 78000 },
          { id: "photography", name: "Photography", ratePerPersonRupees: 750, subtotalRupees: 22500 },
        ],
        perPersonTotalRupees: 5350,
        packageSubtotalRupees: 60000,
        servicesSubtotalRupees: 100500,
        totalEstimateRupees: 160500,
      },
    });
    expect(expected.total).toBe(160500);
  });

  it("ignores any client-supplied totals", () => {
    const result = validateLeadInput(
      estimateEnquiry({ packageCombinedEstimateRupees: 1, totalEstimateRupees: 1, total: 1 }),
    );
    expect(result.success && result.data.packageQuote?.totalEstimateRupees).toBe(160500);
  });

  it("rejects an unknown package or service", () => {
    expect(validateLeadInput(estimateEnquiry({ packageTier: "platinum" })).success).toBe(false);
    expect(validateLeadInput(estimateEnquiry({ packageVendorAddonIds: ["fireworks"] })).success).toBe(false);
  });

  it("keeps plain homepage enquiries (no estimate) working with no quote", () => {
    const plain = estimateEnquiry({
      packageTier: undefined,
      packageGuestCount: undefined,
      packageVendorAddonIds: undefined,
      venueType: "Indoor",
    });
    const result = validateLeadInput(plain);
    expect(result.success).toBe(true);
    expect(result.success && result.data.packageQuote).toBeNull();
  });
});

describe("estimate-aware enquiry: database persistence", () => {
  it("saves the enquiry and the estimate snapshot on the same lead row", async () => {
    const result = validateLeadInput(estimateEnquiry());
    if (!result.success) throw new Error(result.error);
    const { insert, saved } = saveWith(result.data);
    await saved;
    const row = insert.mock.calls[0][0];
    expect(row).toMatchObject({
      user_name: "Test Guest",
      user_phone: "9876543210",
      user_email: "guest@example.com",
      venue_type: "Both",
      package_tier: "premium",
      package_guest_count: 30,
      package_vendor_addon_ids: ["food", "photography"],
      package_planning_fee_rupees: 60000,
      package_vendor_estimate_rupees: 100500,
      package_combined_estimate_rupees: 160500,
    });
    expect(row.package_estimate_snapshot.packageName).toBe("Premium");
    expect(row.package_estimate_snapshot.totalEstimateRupees).toBe(row.package_combined_estimate_rupees);
  });

  it("does not send the snapshot column for plain enquiries", async () => {
    const result = validateLeadInput(
      estimateEnquiry({ packageTier: undefined, packageGuestCount: undefined, packageVendorAddonIds: undefined }),
    );
    if (!result.success) throw new Error(result.error);
    const { insert, saved } = saveWith(result.data);
    await saved;
    const row = insert.mock.calls[0][0];
    expect(row).not.toHaveProperty("package_estimate_snapshot");
    expect(row.package_tier).toBeNull();
  });

  it("ships an additive migration for the snapshot column", () => {
    const sql = readFileSync(
      path.resolve("supabase/migrations/20261118110529_add_package_estimate_snapshot_to_leads.sql"),
      "utf8",
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS package_estimate_snapshot JSONB NULL/);
    expect(sql).not.toMatch(/DROP|DELETE|UPDATE\s+public\.leads|TRUNCATE|INSERT/i);
  });

  it("guards the snapshot constraint against NULL pass-through", () => {
    const sql = readFileSync(
      path.resolve("supabase/migrations/20261118110529_add_package_estimate_snapshot_to_leads.sql"),
      "utf8",
    );
    const check = sql.split("ADD CONSTRAINT chk_leads_package_estimate_snapshot")[1].split(";")[0];
    for (const required of [
      "COALESCE(",
      "FALSE",
      "jsonb_typeof(package_estimate_snapshot) = 'object'",
      "package_tier IS NOT NULL",
      "package_combined_estimate_rupees IS NOT NULL",
      "package_estimate_snapshot ? 'packageId'",
      "jsonb_typeof(package_estimate_snapshot -> 'packageId') = 'string'",
      "package_estimate_snapshot -> 'packageId' = to_jsonb(package_tier)",
      "package_estimate_snapshot ? 'totalEstimateRupees'",
      "jsonb_typeof(package_estimate_snapshot -> 'totalEstimateRupees') = 'number'",
      "package_estimate_snapshot -> 'totalEstimateRupees' = to_jsonb(package_combined_estimate_rupees)",
    ]) {
      expect(check).toContain(required);
    }
    // No text extraction or casts, which can yield NULL or raise instead of returning FALSE.
    expect(check).not.toMatch(/->>|::/);
  });

  it("writes snapshots that satisfy every constraint condition", () => {
    const result = validateLeadInput(estimateEnquiry());
    if (!result.success) throw new Error(result.error);
    const quote = result.data.packageQuote!;
    const snap = quote.snapshot!;
    expect(typeof snap.packageId).toBe("string");
    expect(snap.packageId).toBe(quote.tierId);
    expect(Number.isInteger(snap.totalEstimateRupees)).toBe(true);
    expect(snap.totalEstimateRupees).toBe(quote.totalEstimateRupees);
  });
});

describe("estimate-aware enquiry: form", () => {
  it("shows the estimate read-only instead of re-asking for it", () => {
    const html = renderToStaticMarkup(
      createElement(CelebrationEstimateCard, {
        estimate: calculatePackageEstimate(30, "premium", ["food", "photography"]),
        editHref: "/estimate?package=premium&packageGuests=30&packageAddons=food,photography",
      }),
    );
    expect(html).toContain("Your Celebration Estimate");
    expect(html).toContain("Premium · 30 Guests");
    expect(html).toContain("Food &amp; catering");
    expect(html).toContain("Photography");
    expect(html).toContain("Indicative Estimate: ₹1,60,500");
    expect(html).not.toMatch(/<input|<select/);
  });

  it("hides the guest-count and services questions when an estimate is present", () => {
    const hero = readFileSync(path.resolve("src/components/Hero.tsx"), "utf8");
    expect(hero).toMatch(/\{!packageQuoteSelection && \(\s*<div className=\{styles\.fieldGroup\}>\s*<label htmlFor="guest-count-select"/);
    expect(hero).toMatch(/\{!packageQuoteSelection && \(\s*<div className=\{styles\.fieldGroup\}>\s*<label className=\{styles\.fieldLabel\}>\s*Services You Need/);
    expect(hero).toContain('"Submit My Enquiry"');
  });
});
