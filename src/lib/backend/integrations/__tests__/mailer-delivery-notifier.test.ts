import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotificationEmail } from "@/lib/mailer";
import { MailerDeliveryNotifier } from "../mailer-delivery-notifier";
import { validateLeadInput, type ValidatedLeadInput } from "../../validation/lead-schema";

vi.mock("@/lib/mailer", () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue({
    success: true,
    delivered: true,
    channel: "resend",
  }),
}));

const baseLead: ValidatedLeadInput = {
  userName: "Aditi Rao",
  userPhone: "9876543210",
  city: "Delhi",
  eventType: "Birthday",
  eventDate: "2026-12-20",
  guestCount: "10–30 guests",
  venueType: "Indoor",
  selectedServices: ["Decor & Styling"],
  budgetRange: "₹50,000 – ₹1,00,000",
  whatsappConsent: true,
  isBot: false,
  packageQuote: null,
};

function sentData(): Record<string, string | string[]> {
  const call = vi.mocked(sendNotificationEmail).mock.calls.at(-1);
  if (!call) throw new Error("sendNotificationEmail was not called");
  return call[0].data;
}

describe("MailerDeliveryNotifier lead estimate", () => {
  const notifier = new MailerDeliveryNotifier();

  beforeEach(() => {
    vi.mocked(sendNotificationEmail).mockClear();
  });

  it("sends the same server-calculated estimate the customer saw", async () => {
    const eventDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const validation = validateLeadInput({
      ...baseLead,
      eventDate,
      packageTier: "luxury",
      packageGuestCount: 25,
      packageVendorAddonIds: ["photography", "food"],
      packageCombinedEstimateRupees: 1,
    });
    expect(validation.success).toBe(true);
    if (!validation.success) return;

    await notifier.notifyLead(validation.data, { requestId: "req-1" });

    const data = sentData();
    expect(data["Decor Package"]).toBe("Luxury · ₹2,500 / person");
    expect(data["Package Guest Count"]).toBe("25");
    expect(data["Decor Package Subtotal (INR)"]).toBe("₹62,500");
    expect(data["Selected Optional Services"]).toEqual([
      "Food & catering · ₹3,380 / person · ₹84,500",
      "Photography · ₹1,000 / person · ₹25,000",
    ]);
    expect(data["Selected Optional Services Subtotal (INR)"]).toBe("₹1,09,500");
    expect(data["Selected Services"]).toEqual(["Decor & Styling"]);
    expect(data["Total Estimated Per Person (INR)"]).toBe("₹6,880");
    expect(data["Indicative Event Estimate (INR)"]).toBe("₹1,72,000");
    expect(String(data["Estimate Note"])).toContain("tax treatment will be confirmed in the final quote");
    expect(JSON.stringify(data)).not.toMatch(/planning fee|vendor estimate|cost|margin|markup|profit/i);
  });

  it("reports a package-only quote with no selected services", async () => {
    await notifier.notifyLead({
      ...baseLead,
      packageQuote: {
        tierId: "essential",
        guestCount: 25,
        serviceIds: [],
        packageSubtotalRupees: 37500,
        servicesSubtotalRupees: 0,
        totalEstimateRupees: 37500,
      },
    });

    const data = sentData();
    expect(data["Selected Optional Services"]).toEqual(["None selected"]);
    expect(data["Indicative Event Estimate (INR)"]).toBe("₹37,500");
  });

  it("reports historical legacy quotes with recorded amounts and legacy labels", async () => {
    await notifier.notifyLead({
      ...baseLead,
      packageQuote: {
        tierId: "premium",
        guestCount: 25,
        serviceIds: ["valet-concierge"],
        packageSubtotalRupees: 50000,
        servicesSubtotalRupees: 8000,
        totalEstimateRupees: 58000,
      },
    });

    const data = sentData();
    expect(data["Planning & coordination fee (legacy quote)"]).toBe("Premium");
    expect(data["Legacy flat vendor estimates"]).toEqual([
      "Guest Valet & Concierge (legacy flat estimate)",
    ]);
    expect(data["Indicative Event Estimate (INR)"]).toBe("₹58,000");
    expect(data["Total Estimated Per Person (INR)"]).toBeUndefined();
    expect(data["Selected Services"]).toEqual(["Decor & Styling"]);
  });

  it("omits quote fields for ordinary enquiries", async () => {
    await notifier.notifyLead(baseLead);

    const data = sentData();
    expect(Object.keys(data).some((key) => /package|estimate|services subtotal/i.test(key))).toBe(false);
    expect(data["Selected Services"]).toEqual(["Decor & Styling"]);
  });

  it("does not notify for bot submissions", async () => {
    const result = await notifier.notifyLead({ ...baseLead, isBot: true });
    expect(result).toEqual({ delivered: false, channel: "noop" });
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });
});
