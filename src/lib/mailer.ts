/**
 * Eventsika Lead & Vendor Notification Mailer Utility
 * 
 * Supports zero-dependency dispatch via:
 * 1. Resend API (RESEND_API_KEY)
 * 2. SendGrid API (SENDGRID_API_KEY)
 * 3. Custom Webhook (LEAD_WEBHOOK_URL)
 * 4. Fallback server logger (when environment variables are awaiting configuration)
 * 
 * Target: care@eventsika.in
 */

export interface LeadEmailPayload {
  type: "celebration_lead" | "vendor_application";
  title: string;
  data: Record<string, string | string[]>;
  replyTo?: string;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateHtmlEmail(payload: LeadEmailPayload): string {
  const isVendor = payload.type === "vendor_application";
  const headerColor = isVendor ? "#6B1D2F" : "#2B211D";
  const accentGold = "#B99A67";

  const rows = Object.entries(payload.data)
    .map(([key, value]) => {
      const displayValue = Array.isArray(value) ? value.join(", ") : value;
      return `
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #ede7df; color: #6e5d53; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; width: 35%;">${escapeHtml(
            key
          )}</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #ede7df; color: #1e1916; font-size: 14px; font-weight: 500;">${escapeHtml(
            displayValue
          )}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(payload.title)}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF7F2; margin: 0; padding: 24px;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #E5DFD5; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(43,33,29,0.06);">
        <!-- Header -->
        <tr>
          <td style="background-color: ${headerColor}; padding: 24px 32px; text-align: center;">
            <p style="margin: 0 0 6px 0; color: ${accentGold}; font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;">EVENTSIKA NOTIFICATION</p>
            <h1 style="margin: 0; color: #FAF7F2; font-size: 20px; font-weight: 700;">${escapeHtml(
              payload.title
            )}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding: 24px 32px;">
            <p style="margin: 0 0 20px 0; color: #4A3B32; font-size: 14px; line-height: 1.6;">
              A new submission was received on <strong>eventsika.in</strong>. Below are the verified details:
            </p>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #FCFAF7; border: 1px solid #EDE7DF; border-radius: 6px;">
              ${rows}
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color: #FAF7F2; padding: 16px 32px; border-top: 1px solid #EDE7DF; text-align: center;">
            <p style="margin: 0; color: #8C7B70; font-size: 12px;">
              Sent securely to <strong>care@eventsika.in</strong> • Timestamp: ${new Date().toUTCString()}
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generatePlainText(payload: LeadEmailPayload): string {
  const lines = Object.entries(payload.data).map(([key, value]) => {
    const displayValue = Array.isArray(value) ? value.join(", ") : value;
    return `${key}: ${displayValue}`;
  });

  return `
[EVENTSIKA NOTIFICATION]
${payload.title}
Timestamp: ${new Date().toUTCString()}

Details:
${lines.join("\n")}

--
Target: care@eventsika.in
`.trim();
}

export async function sendNotificationEmail(
  payload: LeadEmailPayload
): Promise<{ success: boolean; delivered: boolean; error?: string }> {
  const targetEmail = process.env.NOTIFICATION_EMAIL || "care@eventsika.in";
  const fromEmail = process.env.EMAIL_FROM || "Eventsika <care@eventsika.in>";
  const htmlContent = generateHtmlEmail(payload);
  const textContent = generatePlainText(payload);

  // 1. Resend REST API (Zero external npm dependency)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [targetEmail],
          reply_to: payload.replyTo,
          subject: payload.title,
          html: htmlContent,
          text: textContent,
        }),
      });

      if (!res.ok) {
        const errorData = await res.text();
        console.error("[Mailer] Resend API Error:", errorData);
        return { success: false, delivered: false, error: "Email provider error" };
      }

      return { success: true, delivered: true };
    } catch (err) {
      console.error("[Mailer] Resend network error:", err);
      return { success: false, delivered: false, error: "Network error during email dispatch" };
    }
  }

  // 2. SendGrid REST API (Zero external npm dependency)
  if (process.env.SENDGRID_API_KEY) {
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: targetEmail }] }],
          from: { email: fromEmail.replace(/.*<(.+)>/, "$1") },
          reply_to: payload.replyTo ? { email: payload.replyTo } : undefined,
          subject: payload.title,
          content: [
            { type: "text/plain", value: textContent },
            { type: "text/html", value: htmlContent },
          ],
        }),
      });

      if (!res.ok) {
        const errorData = await res.text();
        console.error("[Mailer] SendGrid API Error:", errorData);
        return { success: false, delivered: false, error: "Email provider error" };
      }

      return { success: true, delivered: true };
    } catch (err) {
      console.error("[Mailer] SendGrid network error:", err);
      return { success: false, delivered: false, error: "Network error during email dispatch" };
    }
  }

  // 3. Optional Custom Webhook (e.g. Zapier, Make, Telegram, Hostinger automation)
  if (process.env.LEAD_WEBHOOK_URL) {
    try {
      const res = await fetch(process.env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: payload.type,
          title: payload.title,
          data: payload.data,
          targetEmail,
          timestamp: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        return { success: true, delivered: true };
      }
    } catch (err) {
      console.error("[Mailer] Webhook dispatch error:", err);
    }
  }

  // 4. Development / Staging Fallback (When environment variables are pending)
  console.log(
    `\n========== [NEW LEAD RECEIVED - DELIVER TO: ${targetEmail}] ==========\n` +
      `Subject: ${payload.title}\n` +
      `Timestamp: ${new Date().toISOString()}\n` +
      JSON.stringify(payload.data, null, 2) +
      `\n=======================================================================\n`
  );

  // Return success so user submission is acknowledged gracefully
  return { success: true, delivered: false };
}
