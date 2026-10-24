import { sendNotificationEmail } from "../../mailer";
import { formatCurrency, formatPerPersonRate } from "../../packages-config";
import { summarizePackageQuote } from "../../package-quote-summary";
import { ValidatedLeadInput } from "../validation/lead-schema";
import { ValidatedVendorInput } from "../validation/vendor-schema";
import { DeliveryResult, IDeliveryNotifier } from "./delivery-notifier.interface";

/**
 * Mailer Delivery Notifier Adapter
 *
 * Implements IDeliveryNotifier by delegating to the zero-dependency
 * transactional email and webhook dispatcher in `src/lib/mailer.ts`.
 */
export class MailerDeliveryNotifier implements IDeliveryNotifier {
  async notifyLead(
    lead: ValidatedLeadInput,
    context?: { requestId?: string }
  ): Promise<DeliveryResult> {
    if (lead.isBot) {
      return { delivered: false, channel: "noop" };
    }

    const payloadData: Record<string, string | string[]> = {
      "Client Name": lead.userName,
      "Phone Number": lead.userPhone,
      "City": lead.city,
      "Occasion / Event Type": lead.eventType,
      "Event Date": lead.eventDate,
      "Guest Count": lead.guestCount,
      "Venue Type": lead.venueType,
      "Selected Services": lead.selectedServices,
      "Budget Range": lead.budgetRange,
      "WhatsApp Consent": lead.whatsappConsent ? "Yes" : "No",
    };

    if (lead.packageQuote) {
      const quote = summarizePackageQuote(lead.packageQuote);
      const serviceLines = quote.services.map((service) =>
        service.ratePerPerson !== null && service.subtotal !== null
          ? `${service.name} · ${formatPerPersonRate(service.ratePerPerson)} · ${formatCurrency(service.subtotal)}`
          : service.name
      );
      payloadData[quote.packageLabel] =
        quote.decorRatePerPerson !== null
          ? `${quote.tierName} · ${formatPerPersonRate(quote.decorRatePerPerson)}`
          : quote.tierName;
      payloadData["Package Guest Count"] = String(quote.guestCount);
      payloadData[`${quote.packageLabel} Subtotal (INR)`] =
        formatCurrency(quote.packageSubtotal);
      payloadData[quote.servicesLabel] =
        serviceLines.length ? serviceLines : ["None selected"];
      payloadData[`${quote.servicesLabel} Subtotal (INR)`] =
        formatCurrency(quote.servicesSubtotal);
      if (quote.perPersonTotal !== null) {
        payloadData["Total Estimated Per Person (INR)"] =
          formatCurrency(quote.perPersonTotal);
      }
      payloadData["Indicative Event Estimate (INR)"] = formatCurrency(quote.total);
      payloadData["Estimate Note"] = quote.note;
    }

    if (context?.requestId) {
      payloadData["Request ID"] = context.requestId;
    }

    const result = await sendNotificationEmail({
      type: "celebration_lead",
      title: `New Celebration Inquiry — ${lead.userName} (${lead.eventType}, ${lead.city})`,
      data: payloadData,
    });

    return {
      delivered: result.delivered,
      channel: (result.channel as DeliveryResult["channel"]) || "fallback",
      error: result.error,
    };
  }

  async notifyVendor(
    vendor: ValidatedVendorInput,
    context?: { requestId?: string }
  ): Promise<DeliveryResult> {
    if (vendor.isBot) {
      return { delivered: false, channel: "noop" };
    }

    const payloadData: Record<string, string | string[]> = {
      "Business Name": vendor.businessName,
      "Contact Person": vendor.contactName,
      "WhatsApp Phone": vendor.phone,
      "Email Address": vendor.email,
      "Operating City": vendor.city,
      "Experience Tier": vendor.experience,
      "Portfolio Link": vendor.portfolioUrl,
      "Service Categories": vendor.categories,
    };

    if (context?.requestId) {
      payloadData["Request ID"] = context.requestId;
    }

    const result = await sendNotificationEmail({
      type: "vendor_application",
      title: `New Vendor Application — ${vendor.businessName} (${vendor.city})`,
      data: payloadData,
      replyTo: vendor.email,
    });

    return {
      delivered: result.delivered,
      channel: (result.channel as DeliveryResult["channel"]) || "fallback",
      error: result.error,
    };
  }
}

export const defaultDeliveryNotifier = new MailerDeliveryNotifier();
