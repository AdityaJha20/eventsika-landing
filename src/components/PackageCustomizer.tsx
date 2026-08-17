"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./PackageCustomizer.module.css";

interface PackageOption {
  id: string;
  name: string;
  price: number;
  guestDefault: string;
  tagline: string;
}

interface GuestTier {
  id: string;
  label: string;
  recommendedFor: string;
}

interface AddonOption {
  id: string;
  name: string;
  price: number;
  displayPrice: string;
}

const PACKAGES: PackageOption[] = [
  {
    id: "intimate-soiree",
    name: "Intimate Soirée",
    price: 45000,
    guestDefault: "10–35 Guests",
    tagline: "Cozy home & terrace gatherings",
  },
  {
    id: "grand-utsav",
    name: "Grand Utsav",
    price: 125000,
    guestDefault: "50–120 Guests",
    tagline: "All-in-one full celebration",
  },
  {
    id: "royal-bespoke",
    name: "Royal Bespoke",
    price: 325000,
    guestDefault: "120+ Guests",
    tagline: "Luxury full-scale transformation",
  },
];

const GUEST_TIERS: GuestTier[] = [
  {
    id: "10-35",
    label: "10–35 Guests",
    recommendedFor: "Intimate Soirée",
  },
  {
    id: "50-120",
    label: "50–120 Guests",
    recommendedFor: "Grand Utsav",
  },
  {
    id: "120+",
    label: "120+ Guests",
    recommendedFor: "Royal Bespoke",
  },
];

const ADDONS: AddonOption[] = [
  {
    id: "live-chaat",
    name: "Live Chaat & Mocktail Corner",
    price: 15000,
    displayPrice: "+₹15,000",
  },
  {
    id: "drone-reels",
    name: "Drone Cinematography & Reels",
    price: 18000,
    displayPrice: "+₹18,000",
  },
  {
    id: "live-music",
    name: "Live Acoustic / Sufi Duo",
    price: 20000,
    displayPrice: "+₹20,000",
  },
  {
    id: "hampers",
    name: "Custom Welcome Hampers (50 Boxes)",
    price: 12000,
    displayPrice: "+₹12,000",
  },
  {
    id: "valet-concierge",
    name: "Guest Valet & Concierge Desk",
    price: 8000,
    displayPrice: "+₹8,000",
  },
];

export default function PackageCustomizer() {
  const [selectedPkgId, setSelectedPkgId] = useState<string>("grand-utsav");
  const [selectedGuestTierId, setSelectedGuestTierId] = useState<string>("50-120");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  const selectedPkg =
    PACKAGES.find((p) => p.id === selectedPkgId) || PACKAGES[1];
  const selectedGuestTier =
    GUEST_TIERS.find((g) => g.id === selectedGuestTierId) || GUEST_TIERS[1];

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addonsTotal = selectedAddonIds.reduce((sum, id) => {
    const addon = ADDONS.find((a) => a.id === id);
    return sum + (addon ? addon.price : 0);
  }, 0);

  const grandTotal = selectedPkg.price + addonsTotal;
  const formattedTotal = `₹${grandTotal.toLocaleString("en-IN")}`;
  const formattedBase = `₹${selectedPkg.price.toLocaleString("en-IN")}`;
  const formattedAddons = `₹${addonsTotal.toLocaleString("en-IN")}`;

  return (
    <section
      id="customizer"
      className={styles.section}
      aria-labelledby="customizer-heading"
    >
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <p className={styles.eyebrow}>LIVE CUSTOMIZER</p>
          <h2 id="customizer-heading" className={styles.title}>
            Build Your Custom Quote
          </h2>
          <p className={styles.description}>
            Tailor a celebration package to your vision. Choose your base tier,
            expected guest count, and optional premium add-ons for an instant
            live budget preview.
          </p>
        </div>

        {/* 2-Column Customizer Layout */}
        <div className={styles.grid}>
          {/* Left: Customizer Controls */}
          <div className={styles.controlsCol}>
            {/* Step 1: Package Selection */}
            <fieldset className={styles.stepGroup}>
              <legend className={styles.stepLegend}>
                <span className={styles.stepNum}>1</span>
                <span>Select Your Base Package</span>
              </legend>

              <div
                className={styles.packageRadioGrid}
                role="radiogroup"
                aria-label="Select Base Package"
              >
                {PACKAGES.map((pkg) => {
                  const isSelected = selectedPkgId === pkg.id;
                  return (
                    <label
                      key={pkg.id}
                      className={`${styles.packageRadioCard} ${
                        isSelected ? styles.packageRadioCardActive : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="package-tier"
                        value={pkg.id}
                        checked={isSelected}
                        onChange={() => {
                          setSelectedPkgId(pkg.id);
                          if (pkg.id === "intimate-soiree")
                            setSelectedGuestTierId("10-35");
                          if (pkg.id === "grand-utsav")
                            setSelectedGuestTierId("50-120");
                          if (pkg.id === "royal-bespoke")
                            setSelectedGuestTierId("120+");
                        }}
                        className={styles.radioInput}
                      />
                      <div className={styles.radioTop}>
                        <span className={styles.packageName}>{pkg.name}</span>
                        <span className={styles.packagePrice}>
                          ₹{pkg.price.toLocaleString("en-IN")}
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

            {/* Step 2: Guest Count */}
            <fieldset className={styles.stepGroup}>
              <legend className={styles.stepLegend}>
                <span className={styles.stepNum}>2</span>
                <span>Expected Guest Count</span>
              </legend>

              <div
                className={styles.guestTierGrid}
                role="radiogroup"
                aria-label="Select Expected Guest Count"
              >
                {GUEST_TIERS.map((tier) => {
                  const isSelected = selectedGuestTierId === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedGuestTierId(tier.id)}
                      className={`${styles.guestTierBtn} ${
                        isSelected ? styles.guestTierBtnActive : ""
                      }`}
                    >
                      <span className={styles.guestTierLabel}>
                        {tier.label}
                      </span>
                      <span className={styles.guestTierRec}>
                        Recommended: {tier.recommendedFor}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Step 3: Premium Add-Ons */}
            <fieldset className={styles.stepGroup}>
              <legend className={styles.stepLegend}>
                <span className={styles.stepNum}>3</span>
                <span>Optional Premium Add-Ons</span>
              </legend>

              <div
                className={styles.addonsList}
                role="group"
                aria-label="Select Optional Premium Add-Ons"
              >
                {ADDONS.map((addon) => {
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
                  <span>Base Package ({selectedPkg.name})</span>
                  <span>{formattedBase}</span>
                </div>
                <div className={styles.breakdownRow}>
                  <span>Guest Scale</span>
                  <span className={styles.guestHighlight}>
                    {selectedGuestTier.label}
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
                    const item = ADDONS.find((a) => a.id === id);
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
                Lock In This Package
              </Link>

              <p className={styles.disclaimer}>
                Estimates are indicative and inclusive of standard coordination.
                Final quotation is tailored to your exact venue, custom menu,
                and date availability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
