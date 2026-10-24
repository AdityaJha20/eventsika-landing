import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseLeadRepository } from "../supabase-lead-repository";
import type { ValidatedLeadInput } from "../../validation/lead-schema";

const packageQuote = {
  tierId: "premium" as const,
  guestCount: 25,
  serviceIds: ["food", "photography"],
  packageSubtotalRupees: 50000,
  servicesSubtotalRupees: 83750,
  totalEstimateRupees: 133750,
};

const legacyPackageQuote = {
  tierId: "premium" as const,
  guestCount: 25,
  serviceIds: ["photography-films", "live-music"],
  packageSubtotalRupees: 50000,
  servicesSubtotalRupees: 38000,
  totalEstimateRupees: 88000,
};

const makeLead = (quote: ValidatedLeadInput["packageQuote"] = packageQuote): ValidatedLeadInput => ({
  userName: "Aditi Rao",
  userPhone: "9876543210",
  city: "Delhi",
  eventType: "Birthday",
  eventDate: "2026-12-20",
  guestCount: "10–30 guests",
  venueType: "Indoor",
  selectedServices: ["Photography & Films", "Music & Entertainment"],
  budgetRange: "₹50,000 – ₹1,00,000",
  whatsappConsent: true,
  isBot: false,
  packageQuote: quote,
});

const storedLeadRow = (quoteColumns: Record<string, unknown>) => ({
  id: "lead-uuid-2",
  user_name: "Aditi Rao",
  user_phone: "9876543210",
  city: "Delhi",
  event_type: "Birthday",
  event_date: "2026-12-20",
  guest_count: "10–30 guests",
  venue_type: "Indoor",
  selected_services: ["Photography & Films"],
  budget_range: "₹50,000 – ₹1,00,000",
  whatsapp_consent: true,
  request_id: "req-quote-2",
  created_at: "2026-10-23T10:00:00.000Z",
  updated_at: "2026-10-23T10:00:00.000Z",
  ...quoteColumns,
});

const repositoryReturning = (rows: unknown[]) => {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const select = vi.fn().mockReturnValue({ order });
  const from = vi.fn().mockReturnValue({ select });
  return {
    repository: new SupabaseLeadRepository({ from } as unknown as SupabaseClient),
    from,
    select,
  };
};

describe("SupabaseLeadRepository package quote persistence", () => {
  it("persists only server-validated package quote values with the lead", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "lead-uuid-1", created_at: "2026-10-23T10:00:00.000Z" },
      error: null,
    });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = new SupabaseLeadRepository({ from } as unknown as SupabaseClient);

    const lead = makeLead();
    const result = await repository.saveLead(lead, { requestId: "req-quote-1" });

    expect(from).toHaveBeenCalledWith("leads");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        package_tier: "premium",
        package_guest_count: 25,
        package_vendor_addon_ids: ["food", "photography"],
        package_planning_fee_rupees: 50000,
        package_vendor_estimate_rupees: 83750,
        package_combined_estimate_rupees: 133750,
        request_id: "req-quote-1",
      }),
    );
    expect(result.packageQuote).toEqual(packageQuote);
    expect(result.id).toBe("lead-uuid-1");
  });

  it("reconstructs stored package quote details for the admin workspace", async () => {
    const { repository, from, select } = repositoryReturning([
      storedLeadRow({
        package_tier: "premium",
        package_guest_count: 25,
        package_vendor_addon_ids: ["food", "photography"],
        package_planning_fee_rupees: 50000,
        package_vendor_estimate_rupees: 83750,
        package_combined_estimate_rupees: 133750,
      }),
    ]);

    const leads = await repository.getAllLeads();

    expect(from).toHaveBeenCalledWith("leads");
    expect(select).toHaveBeenCalledWith("*");
    expect(leads[0].packageQuote).toEqual(packageQuote);
  });

  it("returns historical flat add-on quotes exactly as stored without recalculating", async () => {
    const { repository } = repositoryReturning([
      storedLeadRow({
        package_tier: "premium",
        package_guest_count: 25,
        package_vendor_addon_ids: ["photography-films", "live-music"],
        package_planning_fee_rupees: 50000,
        package_vendor_estimate_rupees: 38000,
        package_combined_estimate_rupees: 88000,
      }),
    ]);

    const leads = await repository.getAllLeads();

    expect(leads[0].packageQuote).toEqual(legacyPackageQuote);
  });

  it("reads leads stored without a package quote", async () => {
    const { repository } = repositoryReturning([
      storedLeadRow({
        package_tier: null,
        package_guest_count: null,
        package_vendor_addon_ids: [],
        package_planning_fee_rupees: null,
        package_vendor_estimate_rupees: null,
        package_combined_estimate_rupees: null,
      }),
    ]);

    const leads = await repository.getAllLeads();

    expect(leads[0].packageQuote).toBeNull();
  });

  it("preserves ordinary leads without a package quote", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "lead-uuid-3", created_at: "2026-10-23T10:00:00.000Z" },
      error: null,
    });
    const selectAfterInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });
    const from = vi.fn().mockReturnValue({ insert });
    const repository = new SupabaseLeadRepository({ from } as unknown as SupabaseClient);

    const result = await repository.saveLead(makeLead(null));

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        package_tier: null,
        package_guest_count: null,
        package_vendor_addon_ids: [],
        package_planning_fee_rupees: null,
        package_vendor_estimate_rupees: null,
        package_combined_estimate_rupees: null,
      }),
    );
    expect(result.packageQuote).toBeNull();
  });
});
