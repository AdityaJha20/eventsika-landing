"use client";

import React, { useEffect, useState } from "react";
import { PaymentStatusPanel } from "@/components/consultation/PaymentStatusPanel";
import type { BookingRecoveryHandle } from "@/components/consultation/utils/booking-types";
import {
  loadRecoveryHandle,
  parseRecoveryFragment,
  saveRecoveryHandle,
} from "@/components/consultation/utils/payment-status-client";

/**
 * Resolves the booking handle from the email link fragment (#c=..&t=..) or from this
 * tab's session storage, then removes the fragment from the address bar so the token
 * is not left in history or shared by copy-paste.
 */
export function BookingStatusClient() {
  const [handle, setHandle] = useState<BookingRecoveryHandle | null | undefined>(undefined);

  useEffect(() => {
    const fromLink = parseRecoveryFragment(window.location.hash);
    if (fromLink) {
      saveRecoveryHandle(fromLink);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // One-time read of browser-only state after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHandle(fromLink ?? loadRecoveryHandle());
  }, []);

  if (handle === undefined) return null;
  if (!handle) {
    return (
      <section aria-live="polite">
        <h1>Booking status</h1>
        <p>
          Open the link from your Eventsika email to see your booking. If you were charged and cannot find the email,
          write to care@eventsika.in with your payment reference.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h1 style={{ textAlign: "center" }}>Booking status</h1>
      <PaymentStatusPanel handle={handle} />
    </section>
  );
}
