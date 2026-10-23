import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseLeadRepository } from "../supabase-lead-repository";
import type { ValidatedLeadInput } from "../../validation/lead-schema";

const packageQuote = {
  tierId: "premium" as const,
  guestCount: 25,
  vendorAddonIds: ["photography-films", "live-music"],
  planningFeeRupees: 50000,
  vendorEstimateRupees: 38000,
  combinedEstimateRupees: 88000,
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
        package_vendor_addon_ids: ["photography-films", "live-music"],
        package_planning_fee_rupees: 50000,
        package_vendor_estimate_rupees: 38000,
        package_combined_estimate_rupees: 88000,
        request_id: "req-quote-1",
      }),
    );
    expect(result.packageQuote).toEqual(packageQuote);
    expect(result.id).toBe("lead-uuid-1");
  });

  it("reconstructs stored package quote details for the admin workspace", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
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
          package_tier: "premium",
          package_guest_count: 25,
          package_vendor_addon_ids: ["photography-films", "live-music"],
          package_planning_fee_rupees: 50000,
          package_vendor_estimate_rupees: 38000,
          package_combined_estimate_rupees: 88000,
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    const repository = new SupabaseLeadRepository({ from } as unknown as SupabaseClient);

    const leads = await repository.getAllLeads();

    expect(from).toHaveBeenCalledWith("leads");
    expect(select).toHaveBeenCalledWith("*");
    expect(leads[0].packageQuote).toEqual(packageQuote);
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
