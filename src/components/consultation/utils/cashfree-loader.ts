/**
 * Cashfree Web SDK v3 Dynamic Loader & Checkout Integration (Step 5)
 *
 * Implements the verified Cashfree JavaScript SDK v3 client integration.
 * Complies strictly with Cashfree CDN requirements and CSP policies.
 */

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: "_modal" | "_self" | "_blank" | "_top";
      }) => Promise<{
        error?: {
          message?: string;
          code?: string;
          type?: string;
        };
        redirect?: boolean;
        paymentDetails?: unknown;
      }>;
    };
  }
}

const CASHFREE_SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

let sdkLoadPromise: Promise<void> | null = null;

/**
 * Loads the Cashfree Web SDK v3 asynchronously from the official CDN.
 */
export function loadCashfreeSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cashfree SDK cannot be loaded in server environment."));
  }

  if (typeof window.Cashfree === "function") {
    return Promise.resolve();
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    // Check if script tag is already in DOM
    const existingScript = document.querySelector(`script[src="${CASHFREE_SDK_URL}"]`);
    if (existingScript) {
      if (typeof window.Cashfree === "function") {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Cashfree checkout SDK.")));
      return;
    }

    const script = document.createElement("script");
    script.src = CASHFREE_SDK_URL;
    script.async = true;
    script.crossOrigin = "anonymous";

    script.onload = () => {
      if (typeof window.Cashfree === "function") {
        resolve();
      } else {
        reject(new Error("Cashfree SDK script loaded but window.Cashfree was not initialized."));
      }
    };

    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error("Failed to load Cashfree checkout SDK from CDN."));
    };

    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

export interface LaunchCashfreeCheckoutOptions {
  paymentSessionId: string;
  environment: "sandbox" | "production";
}

export interface CheckoutResult {
  completedOrPending: boolean;
  dismissed: boolean;
  failed: boolean;
  dismissedOrError: boolean;
  errorMessage?: string;
}

/**
 * Initializes Cashfree SDK with appropriate mode and opens modal checkout.
 */
export async function launchCashfreeCheckout({
  paymentSessionId,
  environment,
}: LaunchCashfreeCheckoutOptions): Promise<CheckoutResult> {
  await loadCashfreeSdk();

  if (!window.Cashfree) {
    throw new Error("Cashfree Web SDK is unavailable.");
  }

  const cashfree = window.Cashfree({
    mode: environment,
  });

  try {
    const result = await cashfree.checkout({
      paymentSessionId,
      redirectTarget: "_modal",
    });

    if (result && result.error) {
      const isDismissal = Boolean(
        result.error.code === "payment_aborted" ||
        result.error.code === "user_dropped_error" ||
        result.error.message?.toLowerCase().includes("closed") ||
        result.error.message?.toLowerCase().includes("abort") ||
        result.error.message?.toLowerCase().includes("cancel")
      );

      return {
        completedOrPending: false,
        dismissed: isDismissal,
        failed: !isDismissal,
        dismissedOrError: true,
        errorMessage: isDismissal
          ? "Checkout window closed. You can resume and retry your payment below."
          : result.error.message || "Payment attempt failed. Please try again.",
      };
    }

    // Modal closed with submission, redirect, or paymentDetails
    return {
      completedOrPending: true,
      dismissed: false,
      failed: false,
      dismissedOrError: false,
    };
  } catch (err) {
    return {
      completedOrPending: false,
      dismissed: false,
      failed: true,
      dismissedOrError: true,
      errorMessage: err instanceof Error ? err.message : "Payment checkout closed.",
    };
  }
}
