"use client";

import React from "react";
import { ActiveReservationSession } from "./utils/booking-types";
import { formatIstDate, formatIstSlotRange } from "./utils/countdown-utils";
import styles from "./consultation.module.css";

interface PaymentProcessingViewProps {
  session: ActiveReservationSession;
  onClose: () => void;
}

export function PaymentProcessingView({
  session,
  onClose,
}: PaymentProcessingViewProps) {
  return (
    <div className={styles.processingContainer}>
      <div className={styles.processingSpinner} role="status" aria-label="Loading verification" />

      <h3 className={styles.processingTitle}>Payment Processing</h3>
      <p className={styles.processingSubtitle}>
        We are securely verifying your payment details with our payment partner.
      </p>

      <div className={styles.processingDetailCard}>
        <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#8c7b70", fontWeight: 700, marginBottom: "0.5rem" }}>
          Consultation Summary
        </div>
        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#2b211d", marginBottom: "0.35rem" }}>
          1-on-1 Celebration Planning Consultation (60 Min)
        </div>
        <div style={{ fontSize: "0.9rem", color: "#4a3c35", marginBottom: "0.25rem" }}>
          📅 {formatIstDate(session.slotStartTime)}
        </div>
        <div style={{ fontSize: "0.9rem", color: "#4a3c35", marginBottom: "0.25rem" }}>
          ⏰ {formatIstSlotRange(session.slotStartTime, session.slotEndTime)}
        </div>
        <div style={{ fontSize: "0.9rem", color: "#4a3c35", marginBottom: "0.25rem" }}>
          👤 {session.customerName} ({session.customerCity})
        </div>
        <div style={{ fontSize: "0.9rem", color: "#4a3c35" }}>
          📹 {session.meetingChannel === "video" ? "Google Meet Video Consultation" : "Direct Phone Consultation"}
        </div>
      </div>

      <p className={styles.processingNotice}>
        🔒 Your payment is undergoing server verification. Once verified, your booking will be confirmed and an official calendar invitation along with preparation notes will be sent to <strong>{session.customerEmail}</strong>.
      </p>

      <div>
        <button
          type="button"
          onClick={onClose}
          className={styles.primaryActionBtn}
          style={{ maxWidth: "320px", margin: "0 auto" }}
        >
          Return to Eventsika
        </button>
      </div>
    </div>
  );
}
