"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import HeroFireworks from "./HeroFireworks";
import styles from "./Hero.module.css";
import {
  ADDONS_CONFIG,
  calculatePackageEstimate,
  formatCurrency,
  PACKAGES_CONFIG,
  type PackageTierConfig,
} from "@/lib/packages-config";

const CITY_OPTIONS = [
  "Delhi",
  "Gurgaon",
  "Noida",
  "Mumbai",
  "Kolkata",
  "Other",
];

const EVENT_TYPE_OPTIONS = [
  "Diwali Special",
  "House Party",
  "Birthday",
  "Anniversary",
  "Housewarming",
  "Baby Shower",
  "Satsang & Puja",
  "Festive Party",
  "Family Dinner",
  "Other Celebration",
];

const GUEST_COUNT_OPTIONS = [
  "2–10 guests",
  "10–30 guests",
  "30–50 guests",
  "50–100 guests",
  "100–200 guests",
  "200+ guests",
];

const VENUE_TYPE_OPTIONS = [
  "Indoor",
  "Outdoor",
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
  "₹25,000 – ₹50,000",
  "₹50,000 – ₹1,00,000",
  "₹1,00,000 – ₹2,00,000",
  "₹2,00,000 – ₹3,00,000",
  "₹3,00,000 – ₹5,00,000",
  "₹5,00,000+",
];

interface PackageQuoteSelection {
  tierId: PackageTierConfig["id"];
  guestCount: number;
  vendorAddonIds: string[];
}

function guestCountRangeFor(count: number): string {
  if (count <= 10) return "2–10 guests";
  if (count <= 30) return "10–30 guests";
  if (count <= 50) return "30–50 guests";
  if (count <= 100) return "50–100 guests";
  if (count <= 200) return "100–200 guests";
  return "200+ guests";
}

function serviceOptionsForAddons(addonIds: readonly string[]): string[] {
  const mappedServices: Record<string, string> = {
    "live-chaat": "Food & Catering",
    "photography-films": "Photography & Films",
    "live-music": "Music & Entertainment",
    hampers: "More",
    "valet-concierge": "More",
  };
  return Array.from(new Set(addonIds.map((id) => mappedServices[id]).filter((service): service is string => typeof service === "string")));
}

function isValidPhoneNumber(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return false;

  // Reject any string containing letters or invalid characters (only digits, spaces, dashes, parens, and leading plus allowed)
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) return false;

  const cleanDigits = trimmed.replace(/\D/g, "");

  // 10-digit standard Indian mobile format (starts with 6, 7, 8, or 9)
  if (/^[6-9]\d{9}$/.test(cleanDigits)) return true;

  // 11-12 digit format with country code / zero prefix (e.g. +91 9876543210 or 09876543210)
  if (/^(91|0)[6-9]\d{9}$/.test(cleanDigits)) return true;

  return false;
}

export default function Hero() {
  const [formStep, setFormStep] = useState<"form" | "confirm" | "success">("form");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [city, setCity] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [venueType, setVenueType] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState("");
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packageQuoteSelection, setPackageQuoteSelection] =
    useState<PackageQuoteSelection | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tierId = params.get("package");
    const rawGuestCount = params.get("packageGuests");
    const rawAddonIds = params.get("packageAddons") || "";

    if (!tierId) return;

    const selectedPackage = PACKAGES_CONFIG.find((pkg) => pkg.id === tierId);
    const exactGuestCount = Number(rawGuestCount);
    const vendorAddonIds = rawAddonIds ? rawAddonIds.split(",") : [];
    const hasOnlyKnownAddons = vendorAddonIds.every((id) =>
      ADDONS_CONFIG.some((addon) => addon.id === id)
    );
    const hasNoDuplicateAddons =
      new Set(vendorAddonIds).size === vendorAddonIds.length;

    if (
      !selectedPackage ||
      !Number.isInteger(exactGuestCount) ||
      exactGuestCount < 10 ||
      exactGuestCount > 10000 ||
      !hasOnlyKnownAddons ||
      !hasNoDuplicateAddons
    ) {
      return;
    }

    setPackageQuoteSelection({
      tierId: selectedPackage.id,
      guestCount: exactGuestCount,
      vendorAddonIds,
    });
    setGuestCount(guestCountRangeFor(exactGuestCount));
    setSelectedServices(serviceOptionsForAddons(vendorAddonIds));
  }, []);

  const packageQuoteEstimate = packageQuoteSelection
    ? calculatePackageEstimate(
        packageQuoteSelection.guestCount,
        packageQuoteSelection.tierId,
        packageQuoteSelection.vendorAddonIds
      )
    : null;
  const selectedQuotePackage = packageQuoteSelection
    ? PACKAGES_CONFIG.find((pkg) => pkg.id === packageQuoteSelection.tierId)
    : null;

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();

    if (!userName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!userPhone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!isValidPhoneNumber(userPhone)) {
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
    if (!whatsappConsent) {
      setError("Please agree to be contacted on WhatsApp to proceed.");
      return;
    }

    setError(null);
    setFormStep("confirm");
  };

  const handleFinalSubmit = async () => {
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
          whatsappConsent,
          honeypot,
          packageTier: packageQuoteSelection?.tierId ?? null,
          packageGuestCount: packageQuoteSelection?.guestCount ?? null,
          packageVendorAddonIds: packageQuoteSelection?.vendorAddonIds ?? [],
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

      setFormStep("success");
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        "Network connection error. Please check your connection or contact care@eventsika.in directly."
      );
    } finally {
      setIsSubmitting(false);
    }
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
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 100vw"
          className={styles.heroImage}
        />
        <div className={styles.imageOverlay} />
      </div>

      {/* Decorative Fireworks Layer */}
      <HeroFireworks />

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
                  width={148}
                  height={48}
                  priority
                  className={styles.cardBrandLogo}
                />
              </div>
              <div className={styles.cardDivider} />
              <div className={styles.titleRow}>
                <h2 className={styles.cardTitle}>
                  {formStep === "form" && "Plan your celebration"}
                  {formStep === "confirm" && "Review your celebration"}
                  {formStep === "success" && "Celebration Submitted"}
                </h2>
                {formStep === "form" && <span className={styles.cardSubtitle}>in 2 minutes</span>}
              </div>
            </div>

            {formStep === "form" && (
              <form onSubmit={handleReview} className={styles.form}>
                {packageQuoteSelection && packageQuoteEstimate && selectedQuotePackage && (
                  <div className={styles.summaryGrid} aria-live="polite">
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryKey}>Selected Planning Package</span>
                      <span className={styles.summaryVal}>
                        {selectedQuotePackage.name} · {formatCurrency(selectedQuotePackage.pricePerPerson)} / person
                      </span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryKey}>Package Guest Count</span>
                      <span className={styles.summaryVal}>{packageQuoteSelection.guestCount} guests</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryKey}>Eventsika Planning Fee</span>
                      <span className={styles.summaryVal}>{formatCurrency(packageQuoteEstimate.planningFee)}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryKey}>Selected Vendor Services</span>
                      <span className={styles.summaryVal}>
                        {packageQuoteSelection.vendorAddonIds.map((id) => ADDONS_CONFIG.find((addon) => addon.id === id)?.name || id).join(", ") || "None selected"}
                      </span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryKey}>Selected Vendor Estimates</span>
                      <span className={styles.summaryVal}>{formatCurrency(packageQuoteEstimate.selectedVendorEstimate)}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryKey}>Indicative Combined Estimate</span>
                      <span className={styles.summaryVal}>{formatCurrency(packageQuoteEstimate.combinedEstimate)}</span>
                    </div>
                    <p className={styles.consentText}>
                      Planning and coordination only. Vendor prices are estimates, not confirmed costs; additional vendor services and tax treatment will be clarified in the final proposal.
                    </p>
                  </div>
                )}
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
                        {EVENT_TYPE_OPTIONS.map((type) => {
                          const isDiwali = type === "Diwali Special";
                          return (
                            <option
                              key={type}
                              value={type}
                              className={isDiwali ? styles.highlightedOption : undefined}
                            >
                              {isDiwali ? "✨ Diwali Special" : type}
                            </option>
                          );
                        })}
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
                      {packageQuoteSelection ? "Guest Count (from package estimate)" : "Guest Count"}
                    </label>
                    <div className={styles.selectWrapper}>
                      <select
                        id="guest-count-select"
                        value={guestCount}
                        onChange={(e) => setGuestCount(e.target.value)}
                        disabled={Boolean(packageQuoteSelection)}
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

                {/* WhatsApp Consent Checkbox */}
                <label className={styles.consentRow}>
                  <input
                    type="checkbox"
                    checked={whatsappConsent}
                    onChange={(e) => {
                      setWhatsappConsent(e.target.checked);
                      if (error) setError(null);
                    }}
                    className={styles.consentCheckbox}
                  />
                  <span className={styles.consentText}>
                    I agree to be contacted by Eventsika on WhatsApp regarding my event enquiry.
                  </span>
                </label>

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
                  className={styles.cardButton}
                >
                  Get My Celebration Plan
                </button>
              </form>
            )}

            {formStep === "confirm" && (
              <div className={styles.confirmContainer}>
                <h3 className={styles.confirmHeading}>
                  Do you want to edit something before submitting?
                </h3>

                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Name</span>
                    <span className={styles.summaryVal}>{userName}</span>
                  </div>

                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Phone</span>
                    <span className={styles.summaryVal}>{userPhone}</span>
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

                  {packageQuoteSelection && packageQuoteEstimate && selectedQuotePackage && (
                    <>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryKey}>Planning Package</span>
                        <span className={styles.summaryVal}>{selectedQuotePackage.name} · {packageQuoteSelection.guestCount} guests</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryKey}>Planning Fee</span>
                        <span className={styles.summaryVal}>{formatCurrency(packageQuoteEstimate.planningFee)}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryKey}>Indicative Vendor Estimates</span>
                        <span className={styles.summaryVal}>{formatCurrency(packageQuoteEstimate.selectedVendorEstimate)}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryKey}>Indicative Combined Estimate</span>
                        <span className={styles.summaryVal}>{formatCurrency(packageQuoteEstimate.combinedEstimate)}</span>
                      </div>
                    </>
                  )}
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Budget</span>
                    <span className={styles.summaryVal}>{budgetRange}</span>
                  </div>
                </div>

                {error && <p className={styles.errorText} role="alert">{error}</p>}

                <div className={styles.confirmActions}>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setFormStep("form");
                    }}
                    disabled={isSubmitting}
                    className={styles.confirmYesBtn}
                  >
                    Yes, Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    className={styles.confirmNoBtn}
                  >
                    {isSubmitting ? "Submitting Plan..." : "No, Submit Plan"}
                  </button>
                </div>
              </div>
            )}

            {formStep === "success" && (
              <div className={styles.resultsContainer}>
                <h3 className={styles.resultsTitle}>
                  Congratulations and thank you for sharing your event details with us.
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

                  {packageQuoteSelection && packageQuoteEstimate && selectedQuotePackage && (
                    <>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryKey}>Planning Package</span>
                        <span className={styles.summaryVal}>{selectedQuotePackage.name} · {packageQuoteSelection.guestCount} guests</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryKey}>Planning Fee</span>
                        <span className={styles.summaryVal}>{formatCurrency(packageQuoteEstimate.planningFee)}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryKey}>Indicative Vendor Estimates</span>
                        <span className={styles.summaryVal}>{formatCurrency(packageQuoteEstimate.selectedVendorEstimate)}</span>
                      </div>
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryKey}>Indicative Combined Estimate</span>
                        <span className={styles.summaryVal}>{formatCurrency(packageQuoteEstimate.combinedEstimate)}</span>
                      </div>
                    </>
                  )}
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryKey}>Budget</span>
                    <span className={styles.summaryVal}>{budgetRange}</span>
                  </div>
                </div>

                <div className={styles.resultsActions}>
                  <Link href="#contact" className={styles.resultsCta}>
                    Request a Detailed Quote
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
