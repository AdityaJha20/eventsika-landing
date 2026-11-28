"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BookingRecoveryHandle, ConsultationSlotDto, CustomerPaymentStatusDto } from "./utils/booking-types";
import {
  fetchPaymentStatus,
  isTerminalForPolling,
  POLL_DELAYS_MS,
  requestRebook,
} from "./utils/payment-status-client";
import { formatIstDate, formatIstTime } from "./utils/countdown-utils";
import { ConsultationSlotPicker } from "./ConsultationSlotPicker";
import styles from "./consultation.module.css";

interface PaymentStatusPanelProps {
  handle: BookingRecoveryHandle;
  customerEmail?: string;
  onRetryPayment?: () => void;
  onClose?: () => void;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "status"; status: CustomerPaymentStatusDto }
  | { kind: "not_found" }
  | { kind: "timeout" };

/**
 * Shows the AUTHORITATIVE server status. Never claims success on its own, never
 * tells the customer to pay again while a payment may still be in flight.
 */
export function PaymentStatusPanel({ handle, customerEmail, onRetryPayment, onClose }: PaymentStatusPanelProps) {
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [rebookMessage, setRebookMessage] = useState<string | null>(null);
  const [rebooking, setRebooking] = useState(false);
  const cancelled = useRef(false);

  const poll = useCallback(async () => {
    for (let attempt = 0; attempt <= POLL_DELAYS_MS.length && !cancelled.current; attempt++) {
      const result = await fetchPaymentStatus(handle);
      if (cancelled.current) return;
      if (result.kind === "not_found") {
        setView({ kind: "not_found" });
        return;
      }
      if (result.kind === "ok") {
        setView({ kind: "status", status: result.status });
        if (isTerminalForPolling(result.status)) return;
      }
      if (attempt === POLL_DELAYS_MS.length) break;
      await new Promise((r) => setTimeout(r, POLL_DELAYS_MS[attempt]));
    }
    if (!cancelled.current) {
      setView((v) => (v.kind === "status" && isTerminalForPolling(v.status) ? v : { kind: "timeout" }));
    }
  }, [handle]);

  useEffect(() => {
    cancelled.current = false;
    // Start polling from a timer callback (state is only set asynchronously).
    const timer = setTimeout(() => void poll(), 0);
    return () => {
      cancelled.current = true;
      clearTimeout(timer);
    };
  }, [poll]);

  const rebook = async (slot: ConsultationSlotDto) => {
    if (rebooking) return;
    setRebooking(true);
    setRebookMessage(null);
    const result = await requestRebook(handle, slot.id);
    setRebooking(false);
    setRebookMessage(result.message);
    if (result.ok) void poll();
  };

  const reference =
    view.kind === "status" && view.status.reference ? (
      <p className={styles.processingNotice}>
        Booking reference: <strong>{view.status.reference}</strong>
      </p>
    ) : null;

  let title = "Checking your payment";
  let body: React.ReactNode = (
    <p className={styles.processingSubtitle}>We are confirming your payment with our payment partner. This page updates by itself.</p>
  );
  let spinner = true;

  if (view.kind === "not_found") {
    spinner = false;
    title = "Booking not found";
    body = <p className={styles.processingSubtitle}>We could not find this booking. If you were charged, contact care@eventsika.in with your payment reference.</p>;
  } else if (view.kind === "timeout") {
    spinner = false;
    title = "Still verifying your payment";
    body = (
      <p className={styles.processingSubtitle}>
        Verification is taking longer than usual. <strong>Please do not pay again.</strong> We will email you as soon as it is confirmed. You can reopen this page later to check.
      </p>
    );
  } else if (view.kind === "status") {
    const s = view.status;
    if (s.payment === "verifying" || s.payment === "awaiting_payment") {
      body = (
        <p className={styles.processingSubtitle}>
          Verification in progress. <strong>Please do not pay again.</strong>
        </p>
      );
    } else if (s.payment === "failed" || s.payment === "expired") {
      spinner = false;
      title = "Payment not completed";
      body = (
        <>
          <p className={styles.processingSubtitle}>No payment was received for this attempt.</p>
          {s.canRetryPayment && onRetryPayment ? (
            <button type="button" className={styles.primaryActionBtn} onClick={onRetryPayment} style={{ maxWidth: 320, margin: "0 auto" }}>
              Try payment again
            </button>
          ) : (
            <p className={styles.processingNotice}>Your slot hold has ended. Please choose a new slot to book again.</p>
          )}
        </>
      );
    } else if (s.booking === "confirmed") {
      spinner = false;
      title = "Your consultation is confirmed";
      body = (
        <p className={styles.processingSubtitle}>
          {s.slotStartTime ? `${formatIstDate(s.slotStartTime)} at ${formatIstTime(s.slotStartTime)} IST. ` : ""}
          A confirmation with a calendar invite is on its way{customerEmail ? ` to ${customerEmail}` : ""}.
        </p>
      );
    } else if (s.booking === "action_required") {
      spinner = false;
      title = "Payment received — please pick a new time";
      body = (
        <>
          <p className={styles.processingSubtitle}>
            Your payment was received, but the time you chose is no longer available. <strong>Your appointment is not confirmed yet.</strong> Choose another time below — you will not be charged again.
          </p>
          {rebookMessage && <p className={styles.processingNotice} role="status">{rebookMessage}</p>}
          <div aria-busy={rebooking}>
            <ConsultationSlotPicker onSlotSelected={rebook} />
          </div>
        </>
      );
    } else if (s.payment === "refund_processing" || s.payment === "refunded" || s.payment === "partially_refunded") {
      spinner = false;
      title = s.payment === "refund_processing" ? "Refund in progress" : "Refund processed";
      body = <p className={styles.processingSubtitle}>We will email you when your bank shows the refund.</p>;
    } else {
      spinner = false;
      title = "Payment received";
      body = <p className={styles.processingSubtitle}>Your payment is recorded. Our team will be in touch about your consultation.</p>;
    }
  }

  return (
    <div className={styles.processingContainer} aria-live="polite">
      {spinner && <div className={styles.processingSpinner} role="status" aria-label="Checking payment status" />}
      <h3 className={styles.processingTitle}>{title}</h3>
      {body}
      {reference}
      {onClose && (
        <div>
          <button type="button" onClick={onClose} className={styles.primaryActionBtn} style={{ maxWidth: 320, margin: "0 auto" }}>
            Return to Eventsika
          </button>
        </div>
      )}
    </div>
  );
}
