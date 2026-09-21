"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { BookingStep, ConsultationSlotDto, ActiveReservationSession } from "./utils/booking-types";
import { ConsultationSlotPicker } from "./ConsultationSlotPicker";
import { ConsultationIntakeForm } from "./ConsultationIntakeForm";
import { ConsultationCheckoutView } from "./ConsultationCheckoutView";
import { PaymentProcessingView } from "./PaymentProcessingView";
import styles from "./consultation.module.css";

interface ConsultationBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConsultationBookingModal({
  isOpen,
  onClose,
}: ConsultationBookingModalProps) {
  const [currentStep, setCurrentStep] = useState<BookingStep>("slot");
  const [selectedSlot, setSelectedSlot] = useState<ConsultationSlotDto | null>(null);
  const [reservationSession, setReservationSession] = useState<ActiveReservationSession | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap & Escape key handler & Scroll lock
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousActiveElement.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Simple focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSlotSelected = (slot: ConsultationSlotDto) => {
    setSelectedSlot(slot);
    setCurrentStep("details");
  };

  const handleReservationSuccess = (session: ActiveReservationSession) => {
    setReservationSession(session);
    setCurrentStep("payment");
  };

  const handleResetToSlotPicker = () => {
    setReservationSession(null);
    setCurrentStep("slot");
  };

  const handleBackToSlot = () => {
    setCurrentStep("slot");
  };

  const handlePaymentInitiatedOrCompleted = () => {
    setCurrentStep("confirm");
  };

  return (
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={styles.modalContainer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
      >
        {/* Header with Progress Steps */}
        <header className={styles.modalHeader}>
          <div className={styles.brandGroup}>
            <Image
              src="/images/eventsika-official-logo.png"
              alt="Eventsika"
              width={100}
              height={32}
              className={styles.brandLogo}
              priority
            />
            <span className={styles.brandBadge}>Diwali Special</span>
          </div>

          {/* Progress Indicators (Stitch Visual Direction) */}
          <nav className={styles.progressNav} aria-label="Booking Progress">
            <div
              className={`${styles.progressStep} ${
                currentStep === "slot" ? styles.stepActive : styles.stepCompleted
              }`}
            >
              <span className={styles.stepNumber}>01</span>
              <span>Slot</span>
            </div>

            <div
              className={`${styles.progressStep} ${
                currentStep === "details"
                  ? styles.stepActive
                  : currentStep === "payment" || currentStep === "confirm"
                  ? styles.stepCompleted
                  : ""
              }`}
            >
              <span className={styles.stepNumber}>02</span>
              <span>Details</span>
            </div>

            <div
              className={`${styles.progressStep} ${
                currentStep === "payment"
                  ? styles.stepActive
                  : currentStep === "confirm"
                  ? styles.stepCompleted
                  : ""
              }`}
            >
              <span className={styles.stepNumber}>03</span>
              <span>Payment</span>
            </div>

            <div
              className={`${styles.progressStep} ${
                currentStep === "confirm" ? styles.stepActive : ""
              }`}
            >
              <span className={styles.stepNumber}>04</span>
              <span>Confirm</span>
            </div>
          </nav>

          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close consultation booking"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Dynamic Modal Content Body */}
        <div className={styles.modalBody}>
          {currentStep === "slot" && (
            <ConsultationSlotPicker
              onSlotSelected={handleSlotSelected}
              selectedSlotId={selectedSlot?.id}
            />
          )}

          {currentStep === "details" && selectedSlot && (
            <ConsultationIntakeForm
              selectedSlot={selectedSlot}
              onReservationSuccess={handleReservationSuccess}
              onBack={handleBackToSlot}
            />
          )}

          {currentStep === "payment" && reservationSession && (
            <ConsultationCheckoutView
              session={reservationSession}
              onPaymentInitiatedOrCompleted={handlePaymentInitiatedOrCompleted}
              onResetToSlotPicker={handleResetToSlotPicker}
            />
          )}

          {currentStep === "confirm" && reservationSession && (
            <PaymentProcessingView
              session={reservationSession}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
