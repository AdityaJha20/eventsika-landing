"use client";

import React, { useState } from "react";
import { ConsultationSlotDto, ActiveReservationSession, CustomerFormData } from "./utils/booking-types";
import { formatIstDate, formatIstTime } from "./utils/countdown-utils";
import { mapBookingError } from "./utils/error-mapping";
import styles from "./consultation.module.css";

interface ConsultationIntakeFormProps {
  selectedSlot: ConsultationSlotDto;
  onReservationSuccess: (session: ActiveReservationSession) => void;
  onBack: () => void;
}

const EVENT_OCCASIONS = [
  "Diwali Celebration Gala",
  "Luxury Wedding / Engagement",
  "Milestone Birthday Celebration",
  "Anniversary Gala",
  "Festive Housewarming / Griha Pravesh",
  "Corporate Milestone Celebration",
  "Other Celebration",
];

export function ConsultationIntakeForm({
  selectedSlot,
  onReservationSuccess,
  onBack,
}: ConsultationIntakeFormProps) {
  const [formData, setFormData] = useState<CustomerFormData>({
    customerFirstName: "",
    customerLastName: "",
    customerPhone: "",
    customerEmail: "",
    customerCity: "",
    eventType: "Diwali Celebration Gala",
    eventTypeOther: "",
    guestCount: "",
    eventDateApprox: "",
    meetingChannel: "video",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CustomerFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const validateClient = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerFormData, string>> = {};

    if (!formData.customerFirstName.trim()) {
      newErrors.customerFirstName = "First name is required.";
    } else if (formData.customerFirstName.trim().length > 60) {
      newErrors.customerFirstName = "First name must not exceed 60 characters.";
    }

    if (!formData.customerLastName.trim()) {
      newErrors.customerLastName = "Last name is required.";
    } else if (formData.customerLastName.trim().length > 60) {
      newErrors.customerLastName = "Last name must not exceed 60 characters.";
    }

    // Phone validation (accepts 10 digits or prefixed)
    const cleanPhone = formData.customerPhone.replace(/\D/g, "");
    if (!cleanPhone) {
      newErrors.customerPhone = "Phone number is required.";
    } else {
      const tenDigits = cleanPhone.slice(-10);
      if (!/^[6-9]\d{9}$/.test(tenDigits)) {
        newErrors.customerPhone = "Please provide a valid 10-digit Indian mobile number.";
      }
    }

    // Email validation
    if (!formData.customerEmail.trim()) {
      newErrors.customerEmail = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail.trim())) {
      newErrors.customerEmail = "Please provide a valid email address.";
    }

    // City validation
    if (!formData.customerCity.trim()) {
      newErrors.customerCity = "Please enter your city.";
    }

    if (formData.eventType === "Other Celebration" && !formData.eventTypeOther.trim()) {
      newErrors.eventTypeOther = "Please describe your celebration.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validateClient()) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        customerFirstName: formData.customerFirstName.trim(),
        customerLastName: formData.customerLastName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim().toLowerCase(),
        customerCity: formData.customerCity.trim(),
        eventType: formData.eventType,
        eventTypeOther: formData.eventType === "Other Celebration" ? formData.eventTypeOther.trim() : null,
        guestCount: formData.guestCount.trim() || null,
        eventDateApprox: formData.eventDateApprox.trim() || null,
        meetingChannel: formData.meetingChannel,
        slotId: selectedSlot.id,
      };

      const response = await fetch("/api/consultations/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const mapped = mapBookingError(result?.message, response.status);
        setGeneralError(mapped);
        return;
      }

      // Successful reservation hold: create session object
      const session: ActiveReservationSession = {
        consultationId: result.data.consultationId,
        slotId: result.data.slotId,
        reservationToken: result.data.reservationToken,
        reservedUntil: result.data.reservedUntil,
        expiresInSeconds: result.data.expiresInSeconds,
        slotStartTime: selectedSlot.startTime,
        slotEndTime: selectedSlot.endTime,
        customerName: `${formData.customerFirstName.trim()} ${formData.customerLastName.trim()}`,
        customerEmail: formData.customerEmail.trim().toLowerCase(),
        customerPhone: formData.customerPhone.trim(),
        customerCity: formData.customerCity.trim(),
        eventType: formData.eventType === "Other Celebration" ? formData.eventTypeOther.trim() : formData.eventType,
        meetingChannel: formData.meetingChannel,
      };

      onReservationSuccess(session);
    } catch {
      setGeneralError("Network connection interrupted during reservation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.intakeFormContainer}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h2 id="booking-modal-title" className={styles.viewTitle}>
            Celebration &amp; Contact Details
          </h2>
          <p className={styles.viewSubtitle}>
            Your lead director reviews these details before your session to tailor personalized vendor recommendations and blueprints.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className={styles.secondaryActionBtn}
          style={{ padding: "0.4rem 0.75rem", fontSize: "0.8rem", whiteSpace: "nowrap" }}
        >
          ← Change Slot
        </button>
      </div>

      {/* Selected Slot Banner */}
      <div
        style={{
          background: "#faf4ec",
          border: "1px solid #e2d6c7",
          borderRadius: 8,
          padding: "0.85rem 1.15rem",
          marginBottom: "1.75rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div style={{ color: "#7f1010" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#8c7b70", fontWeight: 600 }}>
            Reserved Consultation Slot
          </div>
          <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#2b211d" }}>
            {formatIstDate(selectedSlot.startTime)} • {formatIstTime(selectedSlot.startTime)} – {formatIstTime(selectedSlot.endTime)} IST
          </div>
        </div>
      </div>

      {generalError && (
        <div className={styles.errorBanner} role="alert">
          <svg
            className={styles.errorBannerIcon}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>{generalError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.formGrid}>
          {/* First Name */}
          <div className={styles.formGroup}>
            <label htmlFor="customerFirstName" className={styles.formLabel}>
              First Name *
            </label>
            <input
              id="customerFirstName"
              type="text"
              required
              maxLength={60}
              placeholder="e.g. Priya"
              className={`${styles.formInput} ${errors.customerFirstName ? styles.formInputError : ""}`}
              value={formData.customerFirstName}
              onChange={(e) => setFormData({ ...formData, customerFirstName: e.target.value })}
            />
            {errors.customerFirstName && (
              <span className={styles.fieldErrorText}>{errors.customerFirstName}</span>
            )}
          </div>

          {/* Last Name */}
          <div className={styles.formGroup}>
            <label htmlFor="customerLastName" className={styles.formLabel}>
              Last Name *
            </label>
            <input
              id="customerLastName"
              type="text"
              required
              maxLength={60}
              placeholder="e.g. Sharma"
              className={`${styles.formInput} ${errors.customerLastName ? styles.formInputError : ""}`}
              value={formData.customerLastName}
              onChange={(e) => setFormData({ ...formData, customerLastName: e.target.value })}
            />
            {errors.customerLastName && (
              <span className={styles.fieldErrorText}>{errors.customerLastName}</span>
            )}
          </div>

          {/* Phone */}
          <div className={styles.formGroup}>
            <label htmlFor="customerPhone" className={styles.formLabel}>
              Mobile Phone (India) *
            </label>
            <input
              id="customerPhone"
              type="tel"
              required
              maxLength={15}
              placeholder="10-digit mobile number"
              className={`${styles.formInput} ${errors.customerPhone ? styles.formInputError : ""}`}
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            />
            {errors.customerPhone && (
              <span className={styles.fieldErrorText}>{errors.customerPhone}</span>
            )}
          </div>

          {/* Email */}
          <div className={styles.formGroup}>
            <label htmlFor="customerEmail" className={styles.formLabel}>
              Email Address *
            </label>
            <input
              id="customerEmail"
              type="email"
              required
              maxLength={150}
              placeholder="name@example.com"
              className={`${styles.formInput} ${errors.customerEmail ? styles.formInputError : ""}`}
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
            />
            {errors.customerEmail && (
              <span className={styles.fieldErrorText}>{errors.customerEmail}</span>
            )}
          </div>

          {/* City */}
          <div className={styles.formGroup}>
            <label htmlFor="customerCity" className={styles.formLabel}>
              City *
            </label>
            <input
              id="customerCity"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. New Delhi, Mumbai, Bengaluru"
              className={`${styles.formInput} ${errors.customerCity ? styles.formInputError : ""}`}
              value={formData.customerCity}
              onChange={(e) => setFormData({ ...formData, customerCity: e.target.value })}
            />
            {errors.customerCity && (
              <span className={styles.fieldErrorText}>{errors.customerCity}</span>
            )}
          </div>

          {/* Event Occasion */}
          <div className={styles.formGroup}>
            <label htmlFor="eventType" className={styles.formLabel}>
              Celebration Occasion *
            </label>
            <select
              id="eventType"
              className={styles.formSelect}
              value={formData.eventType}
              onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
            >
              {EVENT_OCCASIONS.map((occ) => (
                <option key={occ} value={occ}>
                  {occ}
                </option>
              ))}
            </select>
          </div>

          {/* Other Event Type if Selected */}
          {formData.eventType === "Other Celebration" && (
            <div className={styles.formGroupFull}>
              <label htmlFor="eventTypeOther" className={styles.formLabel}>
                Please Describe Your Celebration *
              </label>
              <input
                id="eventTypeOther"
                type="text"
                maxLength={100}
                placeholder="e.g. Rooftop Golden Jubilee Gala"
                className={`${styles.formInput} ${errors.eventTypeOther ? styles.formInputError : ""}`}
                value={formData.eventTypeOther}
                onChange={(e) => setFormData({ ...formData, eventTypeOther: e.target.value })}
              />
              {errors.eventTypeOther && (
                <span className={styles.fieldErrorText}>{errors.eventTypeOther}</span>
              )}
            </div>
          )}

          {/* Guest Count */}
          <div className={styles.formGroup}>
            <label htmlFor="guestCount" className={styles.formLabel}>
              Estimated Guests <span className={styles.formLabelOptional}>(Optional)</span>
            </label>
            <input
              id="guestCount"
              type="text"
              maxLength={50}
              placeholder="e.g. 50 - 100 guests"
              className={styles.formInput}
              value={formData.guestCount}
              onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
            />
          </div>

          {/* Approx Event Date */}
          <div className={styles.formGroup}>
            <label htmlFor="eventDateApprox" className={styles.formLabel}>
              Approximate Celebration Date <span className={styles.formLabelOptional}>(Optional)</span>
            </label>
            <input
              id="eventDateApprox"
              type="text"
              maxLength={50}
              placeholder="e.g. Late November 2026"
              className={styles.formInput}
              value={formData.eventDateApprox}
              onChange={(e) => setFormData({ ...formData, eventDateApprox: e.target.value })}
            />
          </div>

          {/* Meeting Channel */}
          <div className={styles.formGroupFull}>
            <span className={styles.formLabel}>Preferred Consultation Format *</span>
            <div className={styles.channelToggleGroup} role="radiogroup" aria-label="Meeting Channel">
              <button
                type="button"
                role="radio"
                aria-checked={formData.meetingChannel === "video"}
                className={`${styles.channelOption} ${formData.meetingChannel === "video" ? styles.channelOptionActive : ""}`}
                onClick={() => setFormData({ ...formData, meetingChannel: "video" })}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                <div className={styles.channelOptionText}>
                  <span className={styles.channelOptionTitle}>Google Meet Video</span>
                  <span className={styles.channelOptionDesc}>Recommended for screen sharing &amp; blueprints</span>
                </div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={formData.meetingChannel === "phone"}
                className={`${styles.channelOption} ${formData.meetingChannel === "phone" ? styles.channelOptionActive : ""}`}
                onClick={() => setFormData({ ...formData, meetingChannel: "phone" })}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <div className={styles.channelOptionText}>
                  <span className={styles.channelOptionTitle}>Direct Phone Call</span>
                  <span className={styles.channelOptionDesc}>Convenient mobile audio consultation</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button
            type="submit"
            disabled={submitting}
            className={styles.primaryActionBtn}
          >
            {submitting ? (
              <span>Reserving Consultation Slot...</span>
            ) : (
              <>
                <span>Reserve Slot &amp; Review (15-Min Hold)</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
