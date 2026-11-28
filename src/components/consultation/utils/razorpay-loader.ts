/**
 * Razorpay Standard Checkout loader (browser only).
 *
 * Loads https://checkout.razorpay.com/v1/checkout.js once and opens the official
 * modal with a SERVER-created order. Card, UPI PIN, OTP and bank credentials are
 * entered only inside Razorpay's own UI; Eventsika never sees them.
 *
 * The returned outcome is a hint for the UI, never payment truth:
 *  - "success": the browser received ids + signature -> must be verified server-side
 *  - "failed":  the last attempt in the modal failed and the customer closed it
 *  - "dismissed": closed without a result (payment may still be in flight)
 */

import type { PaymentOrderResponseData } from "./booking-types";

export const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const LOAD_TIMEOUT_MS = 15_000;

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export type CheckoutOutcome =
  | { type: "success"; response: RazorpaySuccessResponse }
  | { type: "failed"; message: string }
  | { type: "dismissed" }
  /** Checkout was never opened: too little server-held reservation time remained. */
  | { type: "expired" }
  /** Checkout closed because its reservation-bound timeout elapsed (payment may still be in flight). */
  | { type: "timed_out" };

/** Checkout closes this long before the server hold ends, so a payment finishing at the
 *  last moment still lands while the slot is held. */
export const CHECKOUT_SAFETY_BUFFER_SECONDS = 20;
/** Never open checkout with less usable time than this. */
export const MIN_CHECKOUT_WINDOW_SECONDS = 60;
/** Grace after the deadline before we stop waiting for Razorpay's own close callback. */
const TIMEOUT_FALLBACK_GRACE_MS = 5_000;

/**
 * Razorpay `timeout` (seconds) derived from the SERVER-reported remaining reservation
 * time minus the time elapsed since that response, minus a safety buffer. Returns null
 * when checkout must not be opened.
 */
export function computeCheckoutTimeoutSeconds(reservationExpiresInSeconds: number, elapsedMs: number): number | null {
  if (!Number.isFinite(reservationExpiresInSeconds) || !Number.isFinite(elapsedMs)) return null;
  const usable = Math.floor(reservationExpiresInSeconds - Math.max(0, elapsedMs) / 1000) - CHECKOUT_SAFETY_BUFFER_SECONDS;
  return usable >= MIN_CHECKOUT_WINDOW_SECONDS ? usable : null;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loadPromise: Promise<RazorpayConstructor> | null = null;

export function loadRazorpayCheckout(doc: Document = document): Promise<RazorpayConstructor> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    const timer = setTimeout(() => fail(new Error("Razorpay Checkout took too long to load.")), LOAD_TIMEOUT_MS);
    function fail(err: Error) {
      clearTimeout(timer);
      loadPromise = null; // allow a clean retry
      script.remove();
      reject(err);
    }
    script.onload = () => {
      clearTimeout(timer);
      if (window.Razorpay) resolve(window.Razorpay);
      else fail(new Error("Razorpay Checkout is unavailable."));
    };
    script.onerror = () => fail(new Error("Razorpay Checkout could not be loaded. Check your connection or ad blocker."));
    doc.head.appendChild(script);
  });
  return loadPromise;
}

export async function openRazorpayCheckout(
  order: PaymentOrderResponseData,
  description: string,
  Razorpay?: RazorpayConstructor,
  clock?: { receivedAtMs?: number; now?: () => number }
): Promise<CheckoutOutcome> {
  const now = clock?.now ?? Date.now;
  const receivedAtMs = clock?.receivedAtMs ?? now();
  if (computeCheckoutTimeoutSeconds(order.reservationExpiresInSeconds, now() - receivedAtMs) === null) {
    return { type: "expired" };
  }
  const Ctor = Razorpay ?? (await loadRazorpayCheckout());
  // Re-check after the script load, which can take several seconds.
  const timeoutSeconds = computeCheckoutTimeoutSeconds(order.reservationExpiresInSeconds, now() - receivedAtMs);
  if (timeoutSeconds === null) return { type: "expired" };
  const deadlineMs = now() + timeoutSeconds * 1000;

  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    let lastFailure: string | null = null;
    // Fallback in case Razorpay's own close callback does not fire at the deadline.
    const fallback = setTimeout(() => settle({ type: "timed_out" }), timeoutSeconds * 1000 + TIMEOUT_FALLBACK_GRACE_MS);
    const settle = (outcome: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      resolve(outcome);
    };

    const instance = new Ctor({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "Eventsika",
      description,
      prefill: order.prefill,
      notes: { reference: order.reference },
      theme: { color: "#7f1010" },
      retry: { enabled: true },
      // Bound checkout by the server-held reservation (seconds).
      timeout: timeoutSeconds,
      handler: (response: RazorpaySuccessResponse) => settle({ type: "success", response }),
      modal: {
        confirm_close: true,
        ondismiss: () => {
          if (now() >= deadlineMs - 1000) return settle({ type: "timed_out" });
          settle(lastFailure ? { type: "failed", message: lastFailure } : { type: "dismissed" });
        },
      },
    });
    instance.on("payment.failed", (response) => {
      // The modal stays open so the customer can retry another method.
      lastFailure = response?.error?.description?.slice(0, 160) || "The payment attempt failed.";
    });
    instance.open();
  });
}
