/**
 * Browser helpers for authoritative payment status (server is the only source of
 * truth). The recovery handle is kept in sessionStorage so a refresh in the same tab
 * can resume; it never goes into URLs, logs or analytics.
 */

import type {
  BookingRecoveryHandle,
  CustomerPaymentStatusDto,
} from "./booking-types";
import type { RazorpaySuccessResponse } from "./razorpay-loader";

const STORAGE_KEY = "eventsika.consultation.recovery";

export function saveRecoveryHandle(handle: BookingRecoveryHandle): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handle));
  } catch {
    /* storage unavailable (private mode): recovery after refresh is best effort */
  }
}

export function loadRecoveryHandle(): BookingRecoveryHandle | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BookingRecoveryHandle>;
    return typeof parsed.consultationId === "string" && typeof parsed.reservationToken === "string"
      ? { consultationId: parsed.consultationId, reservationToken: parsed.reservationToken }
      : null;
  } catch {
    return null;
  }
}

export function clearRecoveryHandle(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Parses `#c=<consultationId>&t=<token>` from a status link (fragment never reaches servers). */
export function parseRecoveryFragment(hash: string): BookingRecoveryHandle | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const consultationId = params.get("c");
  const reservationToken = params.get("t");
  if (!consultationId || !reservationToken) return null;
  if (!/^[0-9a-f-]{36}$/i.test(consultationId) || !/^[0-9a-f]{64}$/.test(reservationToken)) return null;
  return { consultationId, reservationToken };
}

export type StatusFetchResult =
  | { kind: "ok"; status: CustomerPaymentStatusDto }
  | { kind: "not_found" }
  | { kind: "retry_later" };

async function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export async function fetchPaymentStatus(handle: BookingRecoveryHandle): Promise<StatusFetchResult> {
  try {
    const res = await post("/api/consultations/payment/status", handle);
    if (res.status === 404) return { kind: "not_found" };
    if (!res.ok) return { kind: "retry_later" };
    const json = (await res.json()) as { success?: boolean; data?: CustomerPaymentStatusDto };
    return json.success && json.data ? { kind: "ok", status: json.data } : { kind: "retry_later" };
  } catch {
    return { kind: "retry_later" };
  }
}

/** Submits the Checkout success callback for server-side verification. */
export async function submitCheckoutForVerification(
  handle: BookingRecoveryHandle,
  response: RazorpaySuccessResponse
): Promise<void> {
  try {
    await post("/api/consultations/payment/verify", { ...handle, ...response });
  } catch {
    // Network loss here is safe: the webhook and status polling still resolve it.
  }
}

export async function requestRebook(
  handle: BookingRecoveryHandle,
  slotId: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await post("/api/consultations/payment/rebook", { ...handle, slotId });
    const json = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: res.ok, message: json.message ?? "Please try again." };
  } catch {
    return { ok: false, message: "Network error. Your payment is safe; please try again." };
  }
}

/** Polling schedule: quick at first, then slower; bounded to ~3 minutes. */
export const POLL_DELAYS_MS = [1500, 2000, 3000, 3000, 5000, 5000, 8000, 8000, 10000, 15000, 15000, 20000, 30000, 30000, 30000];

export type PostCheckoutDecision =
  /** Server shows a payment exists (verifying/paid/...): go to the status view. */
  | "proceed"
  /** Server confirms nothing was paid on this order and the hold is still usable. */
  | "retry_allowed"
  /** Checkout timed out with no payment: the hold has (all but) ended; pick a new slot. */
  | "reservation_ended"
  /** Status unknown: never offer another payment; the status view keeps polling. */
  | "unverified";

/**
 * What the checkout screen may do after Razorpay closes without a success callback.
 * The browser never decides payment truth: another attempt is offered only when the
 * server authoritatively reports no payment, and a window close is never a failure.
 */
export function decideAfterCheckoutClosed(
  outcome: "failed" | "dismissed" | "timed_out",
  status: StatusFetchResult
): PostCheckoutDecision {
  if (status.kind !== "ok") return "unverified";
  const p = status.status.payment;
  const nothingPaid = p === "awaiting_payment" || p === "failed" || p === "expired";
  if (!nothingPaid) return "proceed";
  return outcome === "timed_out" ? "reservation_ended" : "retry_allowed";
}

export function isTerminalForPolling(status: CustomerPaymentStatusDto): boolean {
  return status.payment !== "verifying" && status.payment !== "awaiting_payment";
}
