/**
 * Customer payment / booking email templates and the calendar (.ics) attachment.
 *
 * Pure functions: no I/O. Every customer-supplied value is HTML-escaped. Content
 * follows the locked Eventsika consultation rules; nothing here implies a booking is
 * confirmed unless the caller passes a confirmed slot.
 */

import { CONSULTATION_DURATION_MINUTES, CONSULTATION_TIMEZONE } from "../types/payment-and-consultation";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; contentType: string; contentBase64: string }>;
}

export interface BookingDetails {
  consultationId: string;
  customerFirstName: string;
  meetingChannel: "phone" | "video";
  slotStartIso: string | null;
  slotEndIso: string | null;
  amountInPaise: number;
  paymentReference: string; // our receipt / order reference
  gatewayPaymentId: string | null;
  sequence?: number; // calendar revision (reschedule count)
}

const SUPPORT_EMAIL = "care@eventsika.in";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatIst(iso: string): string {
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: CONSULTATION_TIMEZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso)) + " IST"
  );
}

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
<h2 style="color:#7c2d12;margin:0 0 16px">${escapeHtml(title)}</h2>
${bodyHtml}
<p style="font-size:13px;color:#6b7280;margin-top:32px">Questions? Reply to this email or write to ${SUPPORT_EMAIL}.<br/>Eventsika never asks for card numbers, CVV, UPI PIN or OTPs.</p>
</body></html>`;
}

function rows(pairs: Array<[string, string]>): { html: string; text: string } {
  return {
    html: `<table style="border-collapse:collapse;width:100%">${pairs
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 8px;color:#6b7280;border-bottom:1px solid #eee">${escapeHtml(k)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee"><strong>${escapeHtml(v)}</strong></td></tr>`
      )
      .join("")}</table>`,
    text: pairs.map(([k, v]) => `${k}: ${v}`).join("\n"),
  };
}

const POLICY_TEXT =
  "Reschedule up to 24 hours before your consultation at no extra charge. Cancellations up to 2 hours before the start are eligible for a refund; later cancellations and no-shows are not refunded.";

export function paymentReceiptEmail(d: BookingDetails): EmailContent {
  const t = rows([
    ["Amount paid", formatInr(d.amountInPaise)],
    ["Payment reference", d.paymentReference],
    ...(d.gatewayPaymentId ? ([["Razorpay payment ID", d.gatewayPaymentId]] as Array<[string, string]>) : []),
    ["For", "Eventsika 1-on-1 consultation (60 minutes) with preliminary event plan and budget"],
  ]);
  return {
    subject: "Payment received — Eventsika consultation",
    html: wrap(
      "Payment received",
      `<p>Hi ${escapeHtml(d.customerFirstName)},</p><p>We have received your payment. Keep this email as your receipt.</p>${t.html}`
    ),
    text: `Hi ${d.customerFirstName},\n\nWe have received your payment. Keep this email as your receipt.\n\n${t.text}\n\nQuestions? ${SUPPORT_EMAIL}`,
  };
}

export function bookingConfirmedEmail(d: BookingDetails, kind: "confirmed" | "rescheduled"): EmailContent {
  if (!d.slotStartIso || !d.slotEndIso) {
    throw new Error("A confirmation email requires a confirmed slot.");
  }
  const when = formatIst(d.slotStartIso);
  const t = rows([
    ["Date & time", when],
    ["Duration", `${CONSULTATION_DURATION_MINUTES} minutes`],
    ["Mode", d.meetingChannel === "video" ? "Video call (link will be shared by Eventsika)" : "Phone call (Eventsika will call you)"],
    ["Amount paid", formatInr(d.amountInPaise)],
    ["Booking reference", d.paymentReference],
  ]);
  const title = kind === "rescheduled" ? "Your consultation has been rescheduled" : "Your consultation is confirmed";
  return {
    subject: `${kind === "rescheduled" ? "Rescheduled" : "Confirmed"}: Eventsika consultation on ${when}`,
    html: wrap(
      title,
      `<p>Hi ${escapeHtml(d.customerFirstName)},</p><p>${escapeHtml(title)}. A calendar invite is attached.</p>${t.html}<p style="font-size:14px">${escapeHtml(POLICY_TEXT)}</p>`
    ),
    text: `Hi ${d.customerFirstName},\n\n${title}. A calendar invite is attached.\n\n${t.text}\n\n${POLICY_TEXT}\n\nQuestions? ${SUPPORT_EMAIL}`,
    attachments: [
      {
        filename: "eventsika-consultation.ics",
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        contentBase64: Buffer.from(buildConsultationIcs(d), "utf8").toString("base64"),
      },
    ],
  };
}

export function slotConflictEmail(d: BookingDetails, rebookUrl: string): EmailContent {
  const t = rows([
    ["Amount paid", formatInr(d.amountInPaise)],
    ["Payment reference", d.paymentReference],
  ]);
  return {
    subject: "Action needed: choose a new time for your Eventsika consultation",
    html: wrap(
      "Payment received — please pick a new time",
      `<p>Hi ${escapeHtml(d.customerFirstName)},</p><p>Your payment was received, but the time you selected is no longer available. <strong>Your appointment is not confirmed yet.</strong> Please choose another available time — you will not be charged again.</p>${t.html}<p><a href="${escapeHtml(rebookUrl)}">Choose a new time</a></p>`
    ),
    text: `Hi ${d.customerFirstName},\n\nYour payment was received, but the time you selected is no longer available. Your appointment is NOT confirmed yet. Please choose another available time; you will not be charged again.\n\n${t.text}\n\nChoose a new time: ${rebookUrl}\n\nQuestions? ${SUPPORT_EMAIL}`,
  };
}

export function refundEmail(
  firstName: string,
  amountInPaise: number,
  reference: string,
  stage: "processing" | "processed"
): EmailContent {
  const t = rows([
    ["Refund amount", formatInr(amountInPaise)],
    ["Reference", reference],
  ]);
  const title = stage === "processing" ? "Your refund is being processed" : "Your refund has been processed";
  const note =
    stage === "processing"
      ? "We have asked our payment provider to refund you. Banks usually take 5–7 working days to show the credit."
      : "The refund has been processed by our payment provider. Depending on your bank it may take a few days to appear.";
  return {
    subject: `${title} — Eventsika`,
    html: wrap(title, `<p>Hi ${escapeHtml(firstName)},</p><p>${escapeHtml(note)}</p>${t.html}`),
    text: `Hi ${firstName},\n\n${note}\n\n${t.text}\n\nQuestions? ${SUPPORT_EMAIL}`,
  };
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 event. A stable UID + increasing SEQUENCE lets calendars update on reschedule. */
export function buildConsultationIcs(d: BookingDetails): string {
  if (!d.slotStartIso || !d.slotEndIso) throw new Error("ICS requires a confirmed slot.");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eventsika//Consultation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:consultation-${d.consultationId}@eventsika.in`,
    `SEQUENCE:${d.sequence ?? 0}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(d.slotStartIso)}`,
    `DTEND:${icsDate(d.slotEndIso)}`,
    `SUMMARY:${icsEscape("Eventsika consultation")}`,
    `DESCRIPTION:${icsEscape(
      `${d.meetingChannel === "video" ? "Video call — Eventsika will share the link." : "Phone call — Eventsika will call you."} Reference: ${d.paymentReference}`
    )}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
