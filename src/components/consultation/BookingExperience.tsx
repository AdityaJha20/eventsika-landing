"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { ConsultationBookingModal } from "./ConsultationBookingModal";

interface BookingContextType {
  openBooking: () => void;
  closeBooking: () => void;
  isBookingOpen: boolean;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingModalProvider({ children }: { children: ReactNode }) {
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  const openBooking = () => setIsBookingOpen(true);
  const closeBooking = () => setIsBookingOpen(false);

  return (
    <BookingContext.Provider value={{ openBooking, closeBooking, isBookingOpen }}>
      {children}
      <ConsultationBookingModal isOpen={isBookingOpen} onClose={closeBooking} />
    </BookingContext.Provider>
  );
}

export function useBookingModal(): BookingContextType {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error("useBookingModal must be used within a BookingModalProvider");
  }
  return context;
}

interface BookingTriggerButtonProps {
  variant: "hero" | "card" | "final";
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
}

export function BookingTriggerButton({
  variant,
  className,
  ariaLabel,
  children,
}: BookingTriggerButtonProps) {
  const { openBooking } = useBookingModal();

  if (children) {
    return (
      <button
        type="button"
        onClick={openBooking}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  if (variant === "hero" || variant === "card") {
    return (
      <button
        type="button"
        onClick={openBooking}
        className={className}
        aria-label={ariaLabel || "Book My Consultation for ₹2,999"}
      >
        <span>Book My Consultation — ₹2,999</span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openBooking}
      className={className}
      aria-label={ariaLabel || "Reserve Your Consultation Today"}
    >
      <span>Reserve Your Consultation Today</span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </button>
  );
}
