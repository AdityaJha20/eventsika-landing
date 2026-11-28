"use client";

import React from "react";
import { ActiveReservationSession } from "./utils/booking-types";
import { formatIstDate, formatIstSlotRange } from "./utils/countdown-utils";
import { PaymentStatusPanel } from "./PaymentStatusPanel";
import styles from "./consultation.module.css";

interface PaymentProcessingViewProps {
  session: ActiveReservationSession;
  onClose: () => void;
  onRetryPayment?: () => void;
}

/**
 * Post-checkout screen. Everything about payment/booking state comes from the
 * server via PaymentStatusPanel; this view only adds the selected-slot summary.
 */
export function PaymentProcessingView({ session, onClose, onRetryPayment }: PaymentProcessingViewProps) {
  return (
    <div>
      <PaymentStatusPanel
        handle={{ consultationId: session.consultationId, reservationToken: session.reservationToken }}
        customerEmail={session.customerEmail}
        onRetryPayment={onRetryPayment}
        onClose={onClose}
      />
      <div className={styles.processingDetailCard}>
        <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#8c7b70", fontWeight: 700, marginBottom: "0.5rem" }}>
          Requested consultation
        </div>
        <div style={{ fontSize: "1rem", fontWeight: 600, color: "#2b211d", marginBottom: "0.35rem" }}>
          1-on-1 Celebration Planning Consultation (60 Min)
        </div>
        <div style={{ fontSize: "0.9rem", color: "#4a3c35", marginBottom: "0.25rem" }}>📅 {formatIstDate(session.slotStartTime)}</div>
        <div style={{ fontSize: "0.9rem", color: "#4a3c35", marginBottom: "0.25rem" }}>
          ⏰ {formatIstSlotRange(session.slotStartTime, session.slotEndTime)}
        </div>
        <div style={{ fontSize: "0.9rem", color: "#4a3c35" }}>
          📹 {session.meetingChannel === "video" ? "Video Consultation" : "Phone Consultation"}
        </div>
      </div>
    </div>
  );
}
