"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ConsultationSlotDto } from "./utils/booking-types";
import { formatIstTime, formatIstDate } from "./utils/countdown-utils";
import { mapBookingError } from "./utils/error-mapping";
import styles from "./consultation.module.css";

interface ConsultationSlotPickerProps {
  onSlotSelected: (slot: ConsultationSlotDto) => void;
  selectedSlotId?: string | null;
}

interface GroupedDate {
  dateKey: string;      // YYYY-MM-DD
  displayDay: string;   // e.g. Mon, Tue
  displayDate: string;  // e.g. 24 Oct
  fullDateStr: string;  // e.g. Tuesday, 24 October 2026
  slots: ConsultationSlotDto[];
}

export function ConsultationSlotPicker({
  onSlotSelected,
  selectedSlotId,
}: ConsultationSlotPickerProps) {
  const [slots, setSlots] = useState<ConsultationSlotDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const [currentSelectedSlot, setCurrentSelectedSlot] = useState<ConsultationSlotDto | null>(null);

  const loadSlots = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/consultations/slots", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = mapBookingError(data?.message, response.status);
        setError(errorMsg);
        return;
      }

      const returnedSlots: ConsultationSlotDto[] = data.data?.slots || [];
      setSlots(returnedSlots);

      if (returnedSlots.length > 0) {
        const firstSlotDate = new Date(returnedSlots[0].startTime).toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        });
        setActiveDateKey(firstSlotDate);

        if (selectedSlotId) {
          const matched = returnedSlots.find((s) => s.id === selectedSlotId);
          if (matched) {
            setCurrentSelectedSlot(matched);
            const matchedDate = new Date(matched.startTime).toLocaleDateString("en-CA", {
              timeZone: "Asia/Kolkata",
            });
            setActiveDateKey(matchedDate);
          }
        }
      }
    } catch {
      setError("Unable to connect to our scheduling service. Please check your connection and retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;

    async function initialFetch() {
      try {
        const response = await fetch("/api/consultations/slots", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const data = await response.json();
        if (isCancelled) return;

        if (!response.ok || !data.success) {
          const errorMsg = mapBookingError(data?.message, response.status);
          setError(errorMsg);
          setLoading(false);
          return;
        }

        const returnedSlots: ConsultationSlotDto[] = data.data?.slots || [];
        setSlots(returnedSlots);

        if (returnedSlots.length > 0) {
          const firstSlotDate = new Date(returnedSlots[0].startTime).toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
          });
          setActiveDateKey(firstSlotDate);

          if (selectedSlotId) {
            const matched = returnedSlots.find((s) => s.id === selectedSlotId);
            if (matched) {
              setCurrentSelectedSlot(matched);
              const matchedDate = new Date(matched.startTime).toLocaleDateString("en-CA", {
                timeZone: "Asia/Kolkata",
              });
              setActiveDateKey(matchedDate);
            }
          }
        }
      } catch {
        if (!isCancelled) {
          setError("Unable to connect to our scheduling service. Please check your connection and retry.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    initialFetch();

    return () => {
      isCancelled = true;
    };
  }, [selectedSlotId]);

  // Group slots by IST calendar date
  const groupedDates: GroupedDate[] = useMemo(() => {
    const groups: Record<string, ConsultationSlotDto[]> = {};

    for (const slot of slots) {
      const dateKey = new Date(slot.startTime).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(slot);
    }

    return Object.keys(groups)
      .sort()
      .map((dateKey) => {
        const sampleDate = new Date(groups[dateKey][0].startTime);
        return {
          dateKey,
          displayDay: sampleDate.toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "short",
          }),
          displayDate: sampleDate.toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "numeric",
            month: "short",
          }),
          fullDateStr: formatIstDate(groups[dateKey][0].startTime),
          slots: groups[dateKey],
        };
      });
  }, [slots]);

  const activeGroup = groupedDates.find((g) => g.dateKey === activeDateKey);

  const handleSelectSlot = (slot: ConsultationSlotDto) => {
    setCurrentSelectedSlot(slot);
  };

  const handleContinue = () => {
    if (currentSelectedSlot) {
      onSlotSelected(currentSelectedSlot);
    }
  };

  return (
    <div className={styles.slotPickerContainer}>
      <h2 id="booking-modal-title" className={styles.viewTitle}>
        Select Your Consultation Slot
      </h2>
      <p className={styles.viewSubtitle}>
        Choose an exclusive 60-minute strategy session with our senior celebration directors.
        All times are in Indian Standard Time (IST).
      </p>

      {error && (
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
          <div style={{ flex: 1 }}>{error}</div>
          <button
            type="button"
            onClick={loadSlots}
            className={styles.secondaryActionBtn}
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.78rem" }}
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem 0" }}>
          <div className={styles.processingSpinner} style={{ width: 40, height: 40 }} />
          <p style={{ fontSize: "0.9rem", color: "#8c7b70" }}>
            Retrieving available consultation slots...
          </p>
        </div>
      ) : groupedDates.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 0", background: "#ffffff", borderRadius: 8, border: "1px solid #e2d6c7" }}>
          <p style={{ fontWeight: 600, color: "#2b211d", marginBottom: "0.5rem" }}>
            No slots currently open
          </p>
          <p style={{ fontSize: "0.85rem", color: "#6a5a51", marginBottom: "1.25rem" }}>
            Consultation slots open on a rolling basis with a 24-hour advance lead time.
          </p>
          <button type="button" onClick={loadSlots} className={styles.secondaryActionBtn}>
            Refresh Schedule
          </button>
        </div>
      ) : (
        <>
          {/* Date Selector Chips */}
          <div
            className={styles.dateChipsScroll}
            role="tablist"
            aria-label="Available Consultation Dates"
          >
            {groupedDates.map((group) => {
              const isActive = group.dateKey === activeDateKey;
              return (
                <button
                  key={group.dateKey}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.dateChip} ${isActive ? styles.dateChipActive : ""}`}
                  onClick={() => setActiveDateKey(group.dateKey)}
                >
                  <span className={styles.dateChipDay}>{group.displayDay}</span>
                  <span className={styles.dateChipDate}>{group.displayDate}</span>
                </button>
              );
            })}
          </div>

          {/* Time Slots for Active Date */}
          {activeGroup && (
            <div>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "#5c4d44",
                  marginBottom: "0.85rem",
                }}
              >
                Available Slots for {activeGroup.fullDateStr}
              </div>

              <div className={styles.slotsGrid} role="radiogroup" aria-label="Available Time Slots">
                {activeGroup.slots.map((slot) => {
                  const isSelected = currentSelectedSlot?.id === slot.id;
                  const startTime = formatIstTime(slot.startTime);
                  const endTime = formatIstTime(slot.endTime);

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`${styles.slotCard} ${isSelected ? styles.slotCardSelected : ""}`}
                      onClick={() => handleSelectSlot(slot)}
                    >
                      <span className={styles.slotTimeText}>
                        {startTime} – {endTime}
                      </span>
                      <span className={styles.slotDurationText}>
                        60 Minutes • 1-on-1 Consultation
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className={styles.leadTimeNote}>
            * Consultation bookings require at least 24 hours advance notice to ensure our lead directors review your celebration profile thoroughly.
          </p>

          <div style={{ marginTop: "2rem" }}>
            <button
              type="button"
              disabled={!currentSelectedSlot}
              onClick={handleContinue}
              className={styles.primaryActionBtn}
            >
              <span>Continue to Celebration Details</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
