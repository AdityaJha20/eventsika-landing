"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PACKAGES_CONFIG,
  OPTIONAL_SERVICES_CONFIG,
  MIN_GUEST_COUNT,
  MAX_GUEST_COUNT,
  DEFAULT_GUEST_COUNT,
  DEFAULT_PACKAGE_ID,
  GUEST_PRESETS,
  BASE_PACKAGE_INCLUSION,
  ESTIMATE_DISCLAIMER,
  calculatePackageEstimate,
  formatCurrency,
  formatPerPersonRate,
  type OptionalServiceId,
  type PackageTierId,
} from "@/lib/packages-config";
import { buildPackageQuoteHref } from "@/lib/package-quote";
import styles from "./PackageCustomizer.module.css";

export interface PackageCustomizerProps {
  selectedPackageId?: PackageTierId;
  onPackageSelect?: (id: PackageTierId) => void;
  embedded?: boolean;
}

export default function PackageCustomizer({
  selectedPackageId,
  onPackageSelect,
  embedded = false,
}: PackageCustomizerProps = {}) {
  const [guestCount, setGuestCount] = useState<number>(DEFAULT_GUEST_COUNT);
  const [inputValue, setInputValue] = useState<string>(String(DEFAULT_GUEST_COUNT));
  const [internalPkgId, setInternalPkgId] = useState<PackageTierId>(DEFAULT_PACKAGE_ID);
  const [selectedServiceIds, setSelectedServiceIds] = useState<OptionalServiceId[]>([]);

  const activePkgId = selectedPackageId ?? internalPkgId;

  const selectedPkg =
    PACKAGES_CONFIG.find((p) => p.id === activePkgId) ||
    PACKAGES_CONFIG.find((p) => p.id === DEFAULT_PACKAGE_ID)!;

  const handlePackageSelect = (id: PackageTierId) => {
    if (onPackageSelect) {
      onPackageSelect(id);
    } else {
      setInternalPkgId(id);
    }
  };

  const handleGuestChange = (newCount: number) => {
    const clamped = Math.min(MAX_GUEST_COUNT, Math.max(MIN_GUEST_COUNT, Math.round(newCount)));
    setGuestCount(clamped);
    setInputValue(String(clamped));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= MIN_GUEST_COUNT) {
      setGuestCount(Math.min(MAX_GUEST_COUNT, parsed));
    }
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < MIN_GUEST_COUNT) {
      setGuestCount(MIN_GUEST_COUNT);
      setInputValue(String(MIN_GUEST_COUNT));
    } else {
      const clamped = Math.min(MAX_GUEST_COUNT, parsed);
      setGuestCount(clamped);
      setInputValue(String(clamped));
    }
  };

  const toggleService = (id: OptionalServiceId) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const estimate = calculatePackageEstimate(guestCount, selectedPkg.id, selectedServiceIds);
  const quoteHref = buildPackageQuoteHref({
    tierId: selectedPkg.id,
    guestCount: estimate.guestCount,
    serviceIds: estimate.services.map((service) => service.id),
  });

  const customizerContent = (
    <div className={embedded ? styles.embeddedContainer : styles.container}>
      {/* Section Header */}
      {embedded ? (
        <div className={styles.embeddedHeader}>
          <div className={styles.embeddedDivider} />
          <p className={styles.embeddedEyebrow}>ESTIMATE YOUR CELEBRATION</p>
          <h3 className={styles.embeddedTitle}>Decor Package &amp; Optional Services</h3>
        </div>
      ) : (
        <div className={styles.header}>
          <p className={styles.eyebrow}>LIVE CUSTOMIZER</p>
          <h2 id="customizer-heading" className={styles.title}>
            Build Your Indicative Estimate
          </h2>
          <p className={styles.description}>
            Every package includes decor, priced per guest. Add only the services you need; each is charged per guest at the rate for your chosen package.
          </p>
        </div>
      )}

      {/* 2-Column Customizer Layout */}
      <div className={styles.grid}>
        {/* Left: Customizer Controls */}
        <div className={styles.controlsCol}>
          {/* Step 1: Guest Count */}
          <fieldset className={styles.stepGroup}>
            <legend className={styles.stepLegend}>
              <span className={styles.stepNum}>1</span>
              <span>Expected Guest Count</span>
            </legend>

            <div className={styles.guestInputSection}>
              <div className={styles.stepperRow}>
                <div
                  className={styles.stepperContainer}
                  role="group"
                  aria-label="Adjust guest count"
                >
                  <button
                    type="button"
                    onClick={() => handleGuestChange(guestCount - 5)}
                    disabled={guestCount <= MIN_GUEST_COUNT}
                    aria-label="Decrease guest count by 5"
                    className={styles.stepperBtn}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={MIN_GUEST_COUNT}
                    max={MAX_GUEST_COUNT}
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    aria-label="Enter number of guests"
                    className={styles.stepperInput}
                  />
                  <button
                    type="button"
                    onClick={() => handleGuestChange(guestCount + 5)}
                    disabled={guestCount >= MAX_GUEST_COUNT}
                    aria-label="Increase guest count by 5"
                    className={styles.stepperBtn}
                  >
                    +
                  </button>
                </div>

                <span className={styles.guestCountHelper}>
                  {guestCount <= MIN_GUEST_COUNT ? (
                    <span className={styles.guestMinNotice}>
                      Minimum {MIN_GUEST_COUNT} guests for standard packages
                    </span>
                  ) : (
                    <span>Planning for {guestCount} celebration guests</span>
                  )}
                </span>
              </div>

              {/* Quick Preset Chips */}
              <div className={styles.presetChipsGroup}>
                <span className={styles.presetLabel}>Quick Presets:</span>
                <div
                  className={styles.presetChips}
                  role="radiogroup"
                  aria-label="Popular guest count presets"
                >
                  {GUEST_PRESETS.map((preset) => {
                    const isActive = guestCount === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => handleGuestChange(preset)}
                        className={`${styles.presetChip} ${
                          isActive ? styles.presetChipActive : ""
                        }`}
                      >
                        {preset} guests
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </fieldset>

          {/* Step 2: Package Selection (Only shown when not embedded) */}
          {!embedded && (
            <fieldset className={styles.stepGroup}>
              <legend className={styles.stepLegend}>
                <span className={styles.stepNum}>2</span>
                <span>Select Your Decor Package</span>
              </legend>

              <div
                className={styles.packageRadioGrid}
                role="radiogroup"
                aria-label="Select decor package"
              >
                {PACKAGES_CONFIG.map((pkg) => {
                  const isSelected = activePkgId === pkg.id;
                  return (
                    <label
                      key={pkg.id}
                      className={`${styles.packageRadioCard} ${
                        isSelected ? styles.packageRadioCardActive : ""
                      }`}
                    >
                      {pkg.badge && (
                        <span className={styles.cardBadge}>{pkg.badge}</span>
                      )}

                      <input
                        type="radio"
                        name="package-tier"
                        value={pkg.id}
                        checked={isSelected}
                        onChange={() => handlePackageSelect(pkg.id)}
                        className={styles.radioInput}
                      />
                      <div className={styles.radioTop}>
                        <span className={styles.packageName}>{pkg.name}</span>
                        <span className={styles.packagePrice}>
                          {formatPerPersonRate(pkg.pricePerPerson)}
                        </span>
                      </div>
                      <span className={styles.packageInclusion}>
                        Includes: {BASE_PACKAGE_INCLUSION}
                      </span>
                      <span className={styles.packageTagline}>
                        {pkg.tagline}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Optional Per-Person Services */}
          <fieldset className={styles.stepGroup}>
            <legend className={styles.stepLegend}>
              <span className={styles.stepNum}>{embedded ? 2 : 3}</span>
              <span>Optional Services (per guest)</span>
            </legend>

            <p className={styles.stepHint}>
              Rates shown for the {selectedPkg.name} package. Nothing is added unless you select it.
            </p>

            <div
              className={styles.addonsList}
              role="group"
              aria-label="Select optional per-guest services"
            >
              {OPTIONAL_SERVICES_CONFIG.map((service) => {
                const isChecked = selectedServiceIds.includes(service.id);
                return (
                  <label
                    key={service.id}
                    className={`${styles.addonCard} ${
                      isChecked ? styles.addonCardActive : ""
                    }`}
                  >
                    <div className={styles.checkboxWrapper}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleService(service.id)}
                        className={styles.checkboxInput}
                      />
                      <span
                        className={`${styles.customBox} ${
                          isChecked ? styles.customBoxActive : ""
                        }`}
                        aria-hidden="true"
                      >
                        {isChecked && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={styles.checkIcon}
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                    </div>

                    <div className={styles.addonInfo}>
                      <span className={styles.addonName}>{service.name}</span>
                      <span className={styles.addonPrice}>
                        {formatPerPersonRate(service.ratesPerPerson[selectedPkg.id])}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* Right: Live Estimate Summary Card */}
        <div className={styles.summaryCol}>
          <div className={styles.summaryCard} aria-live="polite">
            <div className={styles.summaryTop}>
              <span className={styles.summaryEyebrow}>INDICATIVE ESTIMATE</span>
              <span className={styles.tierBadge}>{selectedPkg.name}</span>
            </div>

            <div className={styles.totalBlock}>
              <span className={styles.totalLabel}>Indicative Event Estimate*</span>
              <div className={styles.totalFigure}>{formatCurrency(estimate.total)}</div>
              <span className={styles.totalMeta}>
                {formatCurrency(estimate.perPersonTotal)} per person × {estimate.guestCount} guests
              </span>
            </div>

            <div className={styles.breakdownList}>
              <div className={styles.breakdownRow}>
                <span>Decor Package ({selectedPkg.name})</span>
                <span>{formatCurrency(estimate.packageSubtotal)}</span>
              </div>
              <div className={styles.calculationDetail}>
                <span>
                  {estimate.guestCount} guests × {formatPerPersonRate(estimate.decorRatePerPerson)}
                </span>
              </div>

              <div className={styles.breakdownRow}>
                <span>
                  Selected Services
                  {estimate.services.length > 0 ? ` (${estimate.services.length})` : ""}
                </span>
                <span>
                  {estimate.services.length > 0
                    ? `+${formatCurrency(estimate.servicesSubtotal)}`
                    : "None selected"}
                </span>
              </div>
              {estimate.services.length > 0 && (
                <ul className={styles.serviceLines}>
                  {estimate.services.map((service) => (
                    <li key={service.id} className={styles.serviceLine}>
                      <span>
                        {service.name} · {formatPerPersonRate(service.ratePerPerson)}
                      </span>
                      <span>{formatCurrency(service.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className={`${styles.breakdownRow} ${styles.breakdownTotalRow}`}>
                <span>Total Estimated Per Person</span>
                <span>{formatCurrency(estimate.perPersonTotal)}</span>
              </div>
              <div className={styles.calculationDetail}>
                <span>
                  {formatPerPersonRate(estimate.decorRatePerPerson)} decor
                  {estimate.services.length > 0
                    ? ` + ${formatPerPersonRate(estimate.servicesRatePerPerson)} services`
                    : ""}
                </span>
              </div>
            </div>

            <div className={styles.divider} />

            <Link href={quoteHref} className={styles.ctaButton}>
              Request Detailed Quote
            </Link>

            <p className={styles.disclaimer}>*{ESTIMATE_DISCLAIMER}</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return customizerContent;
  }

  return (
    <section
      id="customizer"
      className={styles.section}
      aria-labelledby="customizer-heading"
    >
      {customizerContent}
    </section>
  );
}
