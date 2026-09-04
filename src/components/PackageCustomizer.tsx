"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PACKAGES_CONFIG,
  ADDONS_CONFIG,
  MIN_GUEST_COUNT,
  DEFAULT_GUEST_COUNT,
  DEFAULT_PACKAGE_ID,
  GUEST_PRESETS,
  type PackageTierConfig,
} from "@/lib/packages-config";
import styles from "./PackageCustomizer.module.css";

export interface PackageCustomizerProps {
  selectedPackageId?: PackageTierConfig["id"];
  onPackageSelect?: (id: PackageTierConfig["id"]) => void;
  embedded?: boolean;
}

export default function PackageCustomizer({
  selectedPackageId,
  onPackageSelect,
  embedded = false,
}: PackageCustomizerProps = {}) {
  const [guestCount, setGuestCount] = useState<number>(DEFAULT_GUEST_COUNT);
  const [inputValue, setInputValue] = useState<string>(String(DEFAULT_GUEST_COUNT));
  const [internalPkgId, setInternalPkgId] = useState<PackageTierConfig["id"]>(DEFAULT_PACKAGE_ID);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  const activePkgId = selectedPackageId ?? internalPkgId;

  const selectedPkg =
    PACKAGES_CONFIG.find((p) => p.id === activePkgId) || PACKAGES_CONFIG[1];

  const handlePackageSelect = (id: PackageTierConfig["id"]) => {
    if (onPackageSelect) {
      onPackageSelect(id);
    } else {
      setInternalPkgId(id);
    }
  };

  const handleGuestChange = (newCount: number) => {
    const clamped = Math.max(MIN_GUEST_COUNT, Math.round(newCount));
    setGuestCount(clamped);
    setInputValue(String(clamped));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= MIN_GUEST_COUNT) {
      setGuestCount(parsed);
    }
  };

  const handleInputBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < MIN_GUEST_COUNT) {
      setGuestCount(MIN_GUEST_COUNT);
      setInputValue(String(MIN_GUEST_COUNT));
    } else {
      setGuestCount(parsed);
      setInputValue(String(parsed));
    }
  };

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const basePackageTotal = guestCount * selectedPkg.pricePerGuest;

  const addonsTotal = selectedAddonIds.reduce((sum, id) => {
    const addon = ADDONS_CONFIG.find((a) => a.id === id);
    return sum + (addon ? addon.price : 0);
  }, 0);

  const grandTotal = basePackageTotal + addonsTotal;
  const formattedTotal = `₹${grandTotal.toLocaleString("en-IN")}`;
  const formattedBase = `₹${basePackageTotal.toLocaleString("en-IN")}`;
  const formattedAddons = `₹${addonsTotal.toLocaleString("en-IN")}`;

  const customizerContent = (
    <div className={embedded ? styles.embeddedContainer : styles.container}>
      {/* Section Header */}
      {embedded ? (
        <div className={styles.embeddedHeader}>
          <div className={styles.embeddedDivider} />
          <p className={styles.embeddedEyebrow}>ESTIMATE YOUR CELEBRATION</p>
          <h3 className={styles.embeddedTitle}>Tailor Guest Count &amp; Add-ons</h3>
        </div>
      ) : (
        <div className={styles.header}>
          <p className={styles.eyebrow}>LIVE CUSTOMIZER</p>
          <h2 id="customizer-heading" className={styles.title}>
            Build Your Custom Quote
          </h2>
          <p className={styles.description}>
            Tailor a celebration package to your vision. Choose your expected
            guest count, select your celebration tier, and add optional services
            for an instant live estimate.
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
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    aria-label="Enter number of guests"
                    className={styles.stepperInput}
                  />
                  <button
                    type="button"
                    onClick={() => handleGuestChange(guestCount + 5)}
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
                <span>Select Your Celebration Package</span>
              </legend>

              <div
                className={styles.packageRadioGrid}
                role="radiogroup"
                aria-label="Select Celebration Package"
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
                          {pkg.displayRate}
                        </span>
                      </div>
                      <span className={styles.packageTagline}>
                        {pkg.tagline}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Optional Premium Add-Ons */}
          <fieldset className={styles.stepGroup}>
            <legend className={styles.stepLegend}>
              <span className={styles.stepNum}>{embedded ? 2 : 3}</span>
              <span>Optional Premium Add-Ons</span>
            </legend>

            <div
              className={styles.addonsList}
              role="group"
              aria-label="Select Optional Premium Add-Ons"
            >
              {ADDONS_CONFIG.map((addon) => {
                const isChecked = selectedAddonIds.includes(addon.id);
                return (
                  <label
                    key={addon.id}
                    className={`${styles.addonCard} ${
                      isChecked ? styles.addonCardActive : ""
                    }`}
                  >
                    <div className={styles.checkboxWrapper}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAddon(addon.id)}
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
                      <span className={styles.addonName}>{addon.name}</span>
                      <span className={styles.addonPrice}>
                        {addon.displayPrice}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* Right: Live Quotation Summary Card */}
        <div className={styles.summaryCol}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryTop}>
              <span className={styles.summaryEyebrow}>ESTIMATED PROPOSAL</span>
              <span className={styles.tierBadge}>{selectedPkg.name}</span>
            </div>

            <div className={styles.totalBlock}>
              <span className={styles.totalLabel}>Estimated Total</span>
              <div className={styles.totalFigure}>{formattedTotal}</div>
            </div>

            <div className={styles.breakdownList}>
              <div className={styles.breakdownRow}>
                <span>
                  Base Package ({selectedPkg.name})
                </span>
                <span>{formattedBase}</span>
              </div>
              <div className={styles.calculationDetail}>
                <span>
                  {guestCount} guests × ₹{selectedPkg.pricePerGuest.toLocaleString("en-IN")} / guest
                </span>
              </div>

              {selectedAddonIds.length > 0 && (
                <div className={styles.breakdownRow}>
                  <span>Add-ons ({selectedAddonIds.length} selected)</span>
                  <span>+{formattedAddons}</span>
                </div>
              )}
            </div>

            {selectedAddonIds.length > 0 && (
              <ul className={styles.selectedAddonPills}>
                {selectedAddonIds.map((id) => {
                  const item = ADDONS_CONFIG.find((a) => a.id === id);
                  return item ? (
                    <li key={id} className={styles.addonPill}>
                      {item.name}
                    </li>
                  ) : null;
                })}
              </ul>
            )}

            <div className={styles.divider} />

            <Link href="/#plan-event" className={styles.ctaButton}>
              Request Detailed Quote
            </Link>

            <p className={styles.disclaimer}>
              Estimates are indicative and calculated based on your expected guest
              scale. Final quotation is tailored to your exact venue, custom menu,
              and date availability.
            </p>
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
