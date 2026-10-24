import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotificationEmail } from "@/lib/mailer";
import { LeadsWorkspace } from "@/app/admin/leads/LeadsWorkspace";
import { MailerDeliveryNotifier } from "@/lib/backend/integrations/mailer-delivery-notifier";
import { SupabaseLeadRepository } from "@/lib/backend/repositories/supabase-lead-repository";
import { validateLeadInput } from "@/lib/backend/validation/lead-schema";
import { buildPackageQuoteHref, parsePackageQuoteSearch } from "../package-quote";
import {
  calculatePackageEstimate,
  formatCurrency,
  formatPerPersonRate,
  getPackageTier,
  OPTIONAL_SERVICE_IDS,
  type OptionalServiceId,
  type PackageTierId,
} from "../packages-config";

vi.mock("@/lib/mailer", () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue({
    success: true,
    delivered: true,
    channel: "resend",
  }),
}));

function futureDate(daysAhead: number): string {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function decode(html: string): string {
  return html.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'");
}

/**
 * Follows one customizer selection through every stage that displays or
 * stores the estimate and checks they all report the same figures.
 */
describe.each<[PackageTierId, number, readonly OptionalServiceId[]]>([
  ["essential", 10, []],
  ["premium", 25, ["photography", "food"]],
  ["luxury", 100, OPTIONAL_SERVICE_IDS],
  ["premium", 37, ["videography", "valet", "valet"]],
])("quote flow for %s, %i guests, services %j", (tierId, guests, services) => {
  beforeEach(() => {
    vi.mocked(sendNotificationEmail).mockClear();
  });

  it("agrees across customizer, URL prefill, server, storage, email and admin", async () => {
    // 1. Customizer estimate and the link it builds.
    const customizer = calculatePackageEstimate(guests, tierId, services);
    const href = buildPackageQuoteHref({
      tierId,
      guestCount: customizer.guestCount,
      serviceIds: customizer.services.map((service) => service.id),
    });

    // 2. Hero form parses the link and shows the same estimate.
    const selection = parsePackageQuoteSearch(new URL(href, "https://eventsika.in").search);
    expect(selection).not.toBeNull();
    if (!selection) return;
    const hero = calculatePackageEstimate(
      selection.guestCount,
      selection.tierId,
      selection.serviceIds,
    );
    expect(hero).toEqual(customizer);

    // 3. Server recomputes from the hero payload, ignoring tampered totals.
    const validation = validateLeadInput({
      userName: "Flow Test",
      userPhone: "9876543210",
      city: "Delhi",
      eventType: "Birthday",
      eventDate: futureDate(45),
      guestCount: "30–50 guests",
      venueType: "Indoor",
      selectedServices: ["Decor & Styling"],
      budgetRange: "₹50,000 – ₹1,00,000",
      whatsappConsent: true,
      packageTier: selection.tierId,
      packageGuestCount: selection.guestCount,
      packageVendorAddonIds: selection.serviceIds,
      packageCombinedEstimateRupees: 1,
    });
    expect(validation.success).toBe(true);
    if (!validation.success) return;
    const quote = validation.data.packageQuote;
    expect(quote).toEqual({
      tierId,
      guestCount: customizer.guestCount,
      serviceIds: customizer.services.map((service) => service.id),
      packageSubtotalRupees: customizer.packageSubtotal,
      servicesSubtotalRupees: customizer.servicesSubtotal,
      totalEstimateRupees: customizer.total,
    });

    // 4. Persisted row round-trips unchanged.
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { id: "lead-flow-1", created_at: "2026-10-24T10:00:00.000Z" },
          error: null,
        }),
      }),
    });
    await new SupabaseLeadRepository({
      from: () => ({ insert }),
    } as unknown as SupabaseClient).saveLead(validation.data);
    const insertedRow = insert.mock.calls[0][0];
    expect(insertedRow.package_combined_estimate_rupees).toBe(customizer.total);

    const [storedLead] = await new SupabaseLeadRepository({
      from: () => ({
        select: () => ({
          order: async () => ({
            data: [
              {
                ...insertedRow,
                id: "lead-flow-1",
                created_at: "2026-10-24T10:00:00.000Z",
                updated_at: "2026-10-24T10:00:00.000Z",
              },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient).getAllLeads();
    expect(storedLead.packageQuote).toEqual(quote);

    // 5. Notification email reports the same figures.
    await new MailerDeliveryNotifier().notifyLead(validation.data);
    const email = vi.mocked(sendNotificationEmail).mock.calls[0][0].data;
    expect(email["Decor Package"]).toBe(
      `${getPackageTier(hero.tierId).name} · ${formatPerPersonRate(hero.decorRatePerPerson)}`,
    );
    expect(email["Package Guest Count"]).toBe(String(hero.guestCount));
    expect(email["Decor Package Subtotal (INR)"]).toBe(formatCurrency(hero.packageSubtotal));
    expect(email["Selected Optional Services Subtotal (INR)"]).toBe(
      formatCurrency(hero.servicesSubtotal),
    );
    expect(email["Total Estimated Per Person (INR)"]).toBe(formatCurrency(hero.perPersonTotal));
    expect(email["Indicative Event Estimate (INR)"]).toBe(formatCurrency(hero.total));
    expect(email["Selected Optional Services"]).toEqual(
      hero.services.length
        ? hero.services.map(
            (service) =>
              `${service.name} · ${formatPerPersonRate(service.ratePerPerson)} · ${formatCurrency(service.subtotal)}`,
          )
        : ["None selected"],
    );

    // 6. Admin dossier renders the same figures from the stored lead.
    const adminHtml = decode(
      renderToStaticMarkup(
        createElement(LeadsWorkspace, {
          initialLeads: [storedLead],
          metrics: { totalLeads: 1, newLeadsLast7Days: 1, upcomingCelebrations: 1 },
        }),
      ),
    );
    expect(adminHtml).toContain("Selected Decor Package");
    expect(adminHtml).toContain(formatCurrency(hero.packageSubtotal));
    expect(adminHtml).toContain(formatCurrency(hero.servicesSubtotal));
    expect(adminHtml).toContain(formatCurrency(hero.total));
    expect(adminHtml).toContain(`${formatCurrency(hero.perPersonTotal)} per person`);
    for (const service of hero.services) {
      expect(adminHtml).toContain(`${service.name} (${formatPerPersonRate(service.ratePerPerson)})`);
    }
  });
});

describe("historical lead in the admin dossier", () => {
  it("shows a legacy flat add-on quote exactly as recorded", () => {
    const html = decode(
      renderToStaticMarkup(
        createElement(LeadsWorkspace, {
          initialLeads: [
            {
              id: "lead-legacy-1",
              createdAt: "2026-10-23T10:00:00.000Z",
              userName: "Legacy Lead",
              userPhone: "9876543210",
              city: "Delhi",
              eventType: "Birthday",
              eventDate: "2026-12-20",
              guestCount: "10–30 guests",
              venueType: "Indoor",
              selectedServices: ["Photography & Films"],
              budgetRange: "₹50,000 – ₹1,00,000",
              whatsappConsent: true,
              isBot: false,
              packageQuote: {
                tierId: "premium",
                guestCount: 25,
                serviceIds: ["photography-films", "live-music"],
                packageSubtotalRupees: 50000,
                servicesSubtotalRupees: 38000,
                totalEstimateRupees: 88000,
              },
            },
          ],
          metrics: { totalLeads: 1, newLeadsLast7Days: 1, upcomingCelebrations: 1 },
        }),
      ),
    );

    expect(html).toContain("Selected Package (Legacy Quote)");
    expect(html).toContain("Planning & coordination fee (legacy quote)");
    expect(html).toContain("Photography & Films (legacy flat estimate)");
    expect(html).toContain("Live Acoustic / Sufi Duo (legacy flat estimate)");
    expect(html).toContain("₹38,000");
    expect(html).toContain("₹88,000");
    expect(html).not.toContain("Selected Decor Package");
    expect(html).not.toMatch(/₹[\d,]+ per person/);
  });
});
