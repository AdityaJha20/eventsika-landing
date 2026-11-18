/**
 * Session-scoped flag recording that the homepage enquiry was accepted by /api/leads.
 * Holds no personal data: the value is only "1". Cleared when the browser session ends.
 */
export const LEAD_COMPLETION_KEY = "eventsika:lead-submitted";

export function markLeadSubmitted(storage: Pick<Storage, "setItem"> | undefined = globalThis.sessionStorage): void {
  try {
    storage?.setItem(LEAD_COMPLETION_KEY, "1");
  } catch {
    // Storage blocked (private mode etc.): the visitor is simply treated as not yet enquired.
  }
}

export function hasSubmittedLead(storage: Pick<Storage, "getItem"> | undefined = globalThis.sessionStorage): boolean {
  try {
    return storage?.getItem(LEAD_COMPLETION_KEY) === "1";
  } catch {
    return false;
  }
}

export const CONSULTATION_HREF = "/diwali-consultation";
