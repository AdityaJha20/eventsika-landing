"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ActiveReservationSession } from "./utils/booking-types";
import { formatIstDate, formatIstSlotRange } from "./utils/countdown-utils";
import { mapBookingError } from "./utils/error-mapping";
import { launchCashfreeCheckout } from "./utils/cashfree-loader";
import { ReservationCountdownTimer } from "./ReservationCountdownTimer";
import styles from "./consultation.module.css";

interface ConsultationCheckoutViewProps {
  session: ActiveReservationSession;
  onPaymentInitiatedOrCompleted: () => void;
  onResetToSlotPicker: () => void;
}

export function ConsultationCheckoutView({
  session,
  onPaymentInitiatedOrCompleted,
  onResetToSlotPicker,
}: ConsultationCheckoutViewProps) {
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [isCriticalHold, setIsCriticalHold] = useState(false);
  const [isExpiredHold, setIsExpiredHold] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleProceedToPayment = async () => {
    if (loadingPayment || isCriticalHold || isExpiredHold) {
      return;
    }

    setLoadingPayment(true);
    setPaymentError(null);

    try {
      // 1. Call secure server-authoritative payment order endpoint
      const response = await fetch("/api/consultations/payment/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          consultationId: session.consultationId,
          reservationToken: session.reservationToken,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const mappedError = mapBookingError(result?.code || result?.message, response.status);
        setPaymentError(mappedError);

        if (result?.code === "RESERVATION_EXPIRING_SOON" || result?.code === "RESERVATION_EXPIRED") {
          setIsExpiredHold(true);
        }
        return;
      }

      const { paymentSessionId, environment } = result.data;

      // 2. Open official Cashfree Web SDK modal checkout
      const checkoutResult = await launchCashfreeCheckout({
        paymentSessionId,
        environment,
      });

      if (checkoutResult.completedOrPending) {
        // Control returned from Cashfree: transition to Eventsika processing state
        onPaymentInitiatedOrCompleted();
      } else if (checkoutResult.dismissedOrError) {
        // Modal closed without completing or payment failed: allow safe retry
        setPaymentError(
          checkoutResult.errorMessage ||
            "Checkout window closed. You can resume and retry your payment below."
        );
      }
    } catch {
      setPaymentError("Unable to initiate secure checkout. Please try again.");
    } finally {
      setLoadingPayment(false);
    }
  };

  return (
    <div>
      <div className={styles.checkoutTwoColumnGrid}>
        {/* ================================================================
            LEFT COLUMN: Consultation Summary & Numbered Benefits
           ================================================================ */}
        <div className={styles.checkoutLeftColumn}>
          {/* Reservation Summary Card */}
          <div className={styles.consultationSummaryCard}>
            <div className={styles.summaryHeader}>
              <div>
                <span style={{ fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#7f1010", fontWeight: 700 }}>
                  DIWALI CONSULTATION
                </span>
                <h3 className={styles.summaryTitle}>
                  1-on-1 Celebration Planning
                </h3>
              </div>
              <button
                type="button"
                onClick={onResetToSlotPicker}
                className={styles.changeSlotLink}
                aria-label="Change reserved consultation slot"
              >
                Change Slot
              </button>
            </div>

            {/* Date */}
            <div className={styles.summaryDetailRow}>
              <svg className={styles.summaryDetailIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <div>
                <div className={styles.summaryDetailLabel}>Date &amp; Schedule</div>
                <div className={styles.summaryDetailValue}>
                  {formatIstDate(session.slotStartTime)}
                </div>
              </div>
            </div>

            {/* Time */}
            <div className={styles.summaryDetailRow}>
              <svg className={styles.summaryDetailIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div>
                <div className={styles.summaryDetailLabel}>Time Slot &amp; Duration</div>
                <div className={styles.summaryDetailValue}>
                  {formatIstSlotRange(session.slotStartTime, session.slotEndTime)} (60 Minutes)
                </div>
              </div>
            </div>

            {/* Format & Host */}
            <div className={styles.summaryDetailRow}>
              <svg className={styles.summaryDetailIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <div>
                <div className={styles.summaryDetailLabel}>Consultation Format &amp; Guest</div>
                <div className={styles.summaryDetailValue}>
                  {session.meetingChannel === "video" ? "Google Meet Video" : "Direct Phone Call"} • {session.customerName} ({session.customerCity})
                </div>
              </div>
            </div>
          </div>

          {/* Numbered Consultation Benefits (Stitch Visual Direction) */}
          <div className={styles.benefitsContainer}>
            <h4 className={styles.benefitsHeading}>Your Consultation Inclusions</h4>
            <ul className={styles.benefitsList}>
              <li className={styles.benefitItem}>
                <span className={styles.benefitNumber}>01</span>
                <div className={styles.benefitContent}>
                  <span className={styles.benefitItemTitle}>Personalized Planning Blueprint</span>
                  <span className={styles.benefitItemDesc}>
                    Tailored directly to your home layout, family traditions, and unique guest scale.
                  </span>
                </div>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitNumber}>02</span>
                <div className={styles.benefitContent}>
                  <span className={styles.benefitItemTitle}>Vetted Vendor &amp; Decor Guidance</span>
                  <span className={styles.benefitItemDesc}>
                    Thoughtful recommendations from curated decorators, gourmet caterers, and lighting artists.
                  </span>
                </div>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitNumber}>03</span>
                <div className={styles.benefitContent}>
                  <span className={styles.benefitItemTitle}>Transparent Budget Allocation</span>
                  <span className={styles.benefitItemDesc}>
                    Identify potential cost overflows before booking vendors and optimize festive spending.
                  </span>
                </div>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitNumber}>04</span>
                <div className={styles.benefitContent}>
                  <span className={styles.benefitItemTitle}>Comprehensive Event Strategy</span>
                  <span className={styles.benefitItemDesc}>
                    Receive actionable planning milestones and direct planner notes delivered post-session.
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* ================================================================
            RIGHT COLUMN: Pricing, Countdown, Methods & Pay CTA
           ================================================================ */}
        <div className={styles.checkoutRightColumn}>
          {/* Active Reservation Countdown */}
          <ReservationCountdownTimer
            reservedUntil={session.reservedUntil}
            onCriticalThreshold={(critical) => setIsCriticalHold(critical)}
            onExpired={() => {
              setIsExpiredHold(true);
              setPaymentError("Your 15-minute slot reservation has expired. Please select an available slot to renew your booking.");
            }}
          />

          {/* Authoritative Consultation Pricing */}
          <div className={styles.pricingBreakdownCard}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Consultation Fee</span>
              <span className={styles.totalAmount}>₹2,999</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#8c7b70", marginTop: "0.35rem" }}>
              One-time consultation fee
            </div>
          </div>

          {/* Supported Payment Methods Showcase */}
          <div className={styles.paymentMethodsCard}>
            <div className={styles.paymentMethodsHeading}>Accepted Payment Methods</div>
            <div className={styles.paymentLogosGrid}>
              <span className={styles.methodBadge}>
                <Image src="/payment-logos/upi-icon.svg" alt="UPI" width={28} height={16} />
                <span>UPI</span>
              </span>
              <span className={styles.methodBadge}>
                <Image src="/payment-logos/google-pay-primary-logo-logo-svgrepo-com.svg" alt="Google Pay" width={42} height={18} />
                <span>GPay</span>
              </span>
              <span className={styles.methodBadge}>
                <Image src="/payment-logos/phonepe-icon.svg" alt="PhonePe" width={18} height={18} />
                <span>PhonePe</span>
              </span>
              <span className={styles.methodBadge}>
                <Image src="/payment-logos/paytm-icon.svg" alt="Paytm" width={38} height={14} />
                <span>Paytm</span>
              </span>
              <span className={styles.methodBadge}>
                <span>Cards &amp; NetBanking</span>
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {paymentError && (
            <div className={styles.errorBanner} role="alert">
              <svg className={styles.errorBannerIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div style={{ flex: 1 }}>{paymentError}</div>
            </div>
          )}

          {/* Primary Payment CTA */}
          {isExpiredHold ? (
            <button
              type="button"
              onClick={onResetToSlotPicker}
              className={styles.primaryActionBtn}
              style={{ backgroundColor: "#8c7b70" }}
            >
              <span>Hold Expired — Select New Slot</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              disabled={loadingPayment || isCriticalHold}
              onClick={handleProceedToPayment}
              className={styles.primaryActionBtn}
              aria-label="Proceed to Secure Payment for ₹2,999"
            >
              {loadingPayment ? (
                <span>Preparing Secure Checkout...</span>
              ) : isCriticalHold ? (
                <span>Hold Expiring Soon (&lt; 2 min)</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Proceed to Payment — ₹2,999</span>
                </>
              )}
            </button>
          )}

          {/* Security & Trust Guarantee */}
          <div className={styles.trustFooterNote}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>256-Bit SSL Encryption • RBI Regulated Gateway • No Hidden Charges</span>
          </div>
        </div>
      </div>
    </div>
  );
}
