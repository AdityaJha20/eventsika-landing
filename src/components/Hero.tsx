"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Hero.module.css";

const CITY_OPTIONS = ["Kolkata", "Delhi", "Mumbai", "Bangalore", "Other"];

const EVENT_TYPE_OPTIONS = [
  "Birthday",
  "Anniversary",
  "Housewarming",
  "Baby Shower",
  "Satsang & Puja",
  "Festive Party",
  "Terrace Party",
  "Family Dinner",
  "Other Celebration",
];

const GUEST_COUNT_OPTIONS = [
  "10–30 guests",
  "30–50 guests",
  "50–100 guests",
  "100–200 guests",
  "200+ guests",
];

const VENUE_TYPE_OPTIONS = [
  "Home",
  "Banquet Hall",
  "Hotel",
  "Outdoor",
  "Terrace",
  "Other",
];

const SERVICE_OPTIONS = [
  "Decor & Styling",
  "Food & Catering",
  "Furniture & Seating",
  "Photography & Films",
  "Music & Entertainment",
  "More",
];

const BUDGET_OPTIONS = [
  "Under ₹50,000",
  "₹50,000–₹1,00,000",
  "₹1,00,000–₹2,00,000",
  "₹2,00,000+",
  "Prefer to discuss",
];

export default function Hero() {
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [city, setCity] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [venueType, setVenueType] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!userPhone.trim() || userPhone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!city) {
      setError("Please select your city.");
      return;
    }
    if (!eventType) {
      setError("Please select your event type.");
      return;
    }
    if (!eventDate) {
      setError("Please select your event date.");
      return;
    }
    if (!guestCount) {
      setError("Please select expected guest count.");
      return;
    }
    if (!venueType) {
      setError("Please select venue type.");
      return;
    }
    if (selectedServices.length === 0) {
      setError("Please select at least one service.");
      return;
    }
    if (!budgetRange) {
      setError("Please select a budget range.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName,
          userPhone,
          city,
          eventType,
          eventDate,
          guestCount,
          venueType,
          selectedServices,
          budgetRange,
          honeypot,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        setError(
          data?.message ||
            "Unable to submit your celebration plan. Please verify your details or reach out to care@eventsika.in."
        );
        setIsSubmitting(false);
        return;
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        "Network connection error. Please check your connection or contact care@eventsika.in directly."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setError(null);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      {/* Background Image Container */}
      <div className={styles.imageContainer}>
        <Image
          src="/images/Gemini_Generated_Image_jn6i99jn6i99jn6i.webp"
          alt="Warm Indian celebration decor with floral arrangement and candle lighting"
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.imageOverlay} />
      </div>

      <div className={styles.container}>
        {/* Left Column: Marketing Copy */}
        <div className={styles.leftColumn}>
          <p className={styles.eyebrow}>CELEBRATIONS, BEAUTIFULLY PLANNED</p>
          <h1 id="hero-heading" className={styles.title}>
            <span className={styles.titleSpan}>Your celebration.</span>
            <span className={styles.titleSpan}>Beautifully planned.</span>
          </h1>
          <p className={styles.description}>
            From intimate gatherings to unforgettable celebrations, Eventsika brings
            every detail together.
          </p>
          <div className={styles.ctaGroup}>
            <Link href="#plan-event" className={styles.primaryCta}>
              Plan Your Event
            </Link>
            <Link href="/services" className={styles.secondaryCta}>
              Explore Services
            </Link>
          </div>
        </div>

        {/* Right Column: Integrated Planning Card */}
        <div className={styles.rightColumn} id="plan-event">
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardBrand}>
                <Image
                  src="/images/eventsika-official-logo.png"
                  alt="Eventsika - Celebrate Seamlessly"
                  width={147}
                  height={100}
                  priority
                  className={styles.cardBrandLogo}
                />
              </div>
              <div className={styles.cardDivider} />
              <div className={styles.titleRow}>
                <h2 className={styles.cardTitle}>Plan your celebration</h2>
                <span className={styles.cardSubtitle}>in 2 minutes</span>
              </div>
            </div>

            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className={styles.form}>
                {/* Row 1: Name + Phone */}
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="user-name" className={styles.fieldLabel}>
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="user-name"
                      placeholder="Your Name"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="user-phone" className={styles.fieldLabel}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="user-phone"
                      placeholder="Phone Number"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>

                {/* Row 2: City + Event Type */}
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="city-select" className={styles.fieldLabel}>
                      City
                    </label>
                    <div className={styles.selectWrapper}>
                      <select
                        id="city-select"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={styles.select}
                      >
                        <option value="" disabled>
                          City
                        </option>
                        {CITY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="event-type-select" className={styles.fieldLabel}>
                      Event Type
                    </label>
                    <div className={styles.selectWrapper}>
                      <select
                        id="event-type-select"
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                        className={styles.select}
                      >
                        <option value="" disabled>
                          Event Type
                        </option>
                        {EVENT_TYPE_OPTIONS.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 3: Event Date + Guest Count */}
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="hero-event-date" className={styles.fieldLabel}>
                      Event Date
                    </label>
                    <input
                      type="date"
                      id="hero-event-date"
                      min={today}
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="guest-count-select" className={styles.fieldLabel}>
                      Guest Count
                    </label>
                    <div className={styles.selectWrapper}>
                      <select
                        id="guest-count-select"
                        value={guestCount}
                        onChange={(e) => setGuestCount(e.target.value)}
                        className={styles.select}
                      >
                        <option value="" disabled>
                          Guest Count
                        </option>
                        {GUEST_COUNT_OPTIONS.map((gc) => (
                          <option key={gc} value={gc}>
                            {gc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 4: Venue Type + Budget Range */}
                <div className={styles.formRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="venue-type-select" className={styles.fieldLabel}>
                      Venue Type
                    </label>
                    <div className={styles.selectWrapper}>
                      <select
                        id="venue-type-select"
                        value={venueType}
                        onChange={(e) => setVenueType(e.target.value)}
                        className={styles.select}
                      >
                        <option value="" disabled>
                          Venue Type
                        </option>
                        {VENUE_TYPE_OPTIONS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="budget-range-select" className={styles.fieldLabel}>
                      Budget Range
                    </label>
                    <div className={styles.selectWrapper}>
                      <select
                        id="budget-range-select"
                        value={budgetRange}
                        onChange={(e) => setBudgetRange(e.target.value)}
                        className={styles.select}
                      >
                        <option value="" disabled>
                          Budget Range
                        </option>
                        {BUDGET_OPTIONS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 5: Services You Need (Compact Selectable Grid) */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Services You Need (Select multiple)
                  </label>
                  <div className={styles.servicesGrid}>
                    {SERVICE_OPTIONS.map((service) => {
                      const isSelected = selectedServices.includes(service);
                      return (
                        <label
                          key={service}
                          className={`${styles.serviceBox} ${
                            isSelected ? styles.serviceBoxSelected : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleService(service)}
                            className={styles.checkbox}
                          />
                          <span className={styles.serviceName}>{service}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Honeypot field for bot protection */}
                <div
                  style={{
                    position: "absolute",
                    left: "-9999px",
                    opacity: 0,
                    height: 0,
                    width: 0,
                    pointerEvents: "none",
                  }}
                  aria-hidden="true"
                >
                  <label htmlFor="hero-website-url">Leave this field blank</label>
                  <input
                    type="text"
                    id="hero-website-url"
                    name="website_url"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                {/* Error Message */}
                {error && <p className={styles.errorText} role="alert">{error}</p>}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={styles.cardButton}
                  style={
                    isSubmitting
                      ? { opacity: 0.75, cursor: "not-allowed" }
                      : undefined
                  }
                >
                  {isSubmitting ? "Submitting Plan..." : "Get My Celebration Plan"}
                </button>
              </form>
            ) : (
              /* Results Summary Panel */
              <div className={styles.resultsContainer}>
                <h3 className={styles.resultsTitle}>
                  Your celebration details are ready.
                </h3>

                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Name</span>
                    <span className={styles.summaryVal}>{userName}</span>
                  </div>

                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>City</span>
                    <span className={styles.summaryVal}>{city}</span>
                  </div>

                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Event</span>
                    <span className={styles.summaryVal}>{eventType}</span>
                  </div>

                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Date</span>
                    <span className={styles.summaryVal}>{eventDate}</span>
                  </div>

                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Guests</span>
                    <span className={styles.summaryVal}>{guestCount}</span>
                  </div>

                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Venue</span>
                    <span className={styles.summaryVal}>{venueType}</span>
                  </div>

                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Services</span>
                    <span className={styles.summaryVal}>
                      {selectedServices.join(", ")}
                    </span>
                  </div>

                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Budget</span>
                    <span className={styles.summaryVal}>{budgetRange}</span>
                  </div>
                </div>

                <div className={styles.resultsActions}>
                  <Link href="#contact" className={styles.resultsCta}>
                    Request a Detailed Quote
                  </Link>
                  <button
                    type="button"
                    onClick={handleReset}
                    className={styles.resetBtn}
                  >
                    Edit Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
