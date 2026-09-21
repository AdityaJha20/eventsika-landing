"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  calculateSecondsRemaining,
  formatCountdown,
  getCountdownStatus,
} from "./utils/countdown-utils";
import styles from "./consultation.module.css";

interface ReservationCountdownTimerProps {
  reservedUntil: string;
  onExpired?: () => void;
  onCriticalThreshold?: (isCritical: boolean) => void;
}

export function ReservationCountdownTimer({
  reservedUntil,
  onExpired,
  onCriticalThreshold,
}: ReservationCountdownTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    calculateSecondsRemaining(reservedUntil)
  );

  const hasFiredExpired = useRef(false);
  const hasFiredCritical = useRef(false);

  useEffect(() => {
    // Reset triggers if reservedUntil changes
    hasFiredExpired.current = false;
    hasFiredCritical.current = false;

    const updateTimer = () => {
      const remaining = calculateSecondsRemaining(reservedUntil);
      setSecondsRemaining(remaining);

      if (remaining <= 120 && remaining > 0 && !hasFiredCritical.current) {
        hasFiredCritical.current = true;
        onCriticalThreshold?.(true);
      }

      if (remaining <= 0) {
        if (!hasFiredExpired.current) {
          hasFiredExpired.current = true;
          onExpired?.();
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [reservedUntil, onExpired, onCriticalThreshold]);

  const status = getCountdownStatus(secondsRemaining);

  const statusClassMap = {
    normal: styles.countdownNormal,
    warning: styles.countdownWarning,
    critical: styles.countdownCritical,
    expired: styles.countdownExpired,
  };

  return (
    <div
      className={`${styles.countdownCard} ${statusClassMap[status]}`}
      role="timer"
      aria-live="polite"
      aria-label={`Reservation expires in ${formatCountdown(secondsRemaining)}`}
    >
      <div className={styles.countdownLabelGroup}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span>
          {status === "expired"
            ? "Reservation hold expired"
            : status === "critical"
            ? "Hold expiring soon (< 2 min)"
            : status === "warning"
            ? "Temporary slot hold (< 3 min)"
            : "Temporary 15-minute slot hold"}
        </span>
      </div>

      <span className={styles.countdownDigits}>
        {formatCountdown(secondsRemaining)}
      </span>
    </div>
  );
}
