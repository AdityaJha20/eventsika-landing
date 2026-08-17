"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./ServiceEstimator.module.css";

interface EstimatorOption {
  id: string;
  name: string;
  price: number;
  displayPrice: string;
}

const ESTIMATOR_OPTIONS: EstimatorOption[] = [
  {
    id: "decor",
    name: "Floral & Thematic Decor",
    price: 25000,
    displayPrice: "₹25,000 approx",
  },
  {
    id: "music",
    name: "Sound, DJ & Live Music",
    price: 18000,
    displayPrice: "₹18,000 approx",
  },
  {
    id: "catering",
    name: "Catering (50 guests approx)",
    price: 35000,
    displayPrice: "₹35,000 approx",
  },
  {
    id: "manager",
    name: "On-site Event Manager",
    price: 12000,
    displayPrice: "₹12,000 approx",
  },
  {
    id: "photo",
    name: "Candid Photography & Video",
    price: 20000,
    displayPrice: "₹20,000 approx",
  },
  {
    id: "invites",
    name: "Digital Invites & Hampers",
    price: 8000,
    displayPrice: "₹8,000 approx",
  },
];

export default function ServiceEstimator() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleOption = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const totalCost = selectedIds.reduce((sum, id) => {
    const item = ESTIMATOR_OPTIONS.find((opt) => opt.id === id);
    return sum + (item ? item.price : 0);
  }, 0);

  const formattedTotal = `₹${totalCost.toLocaleString("en-IN")}`;
  const selectedCount = selectedIds.length;
  const totalCount = ESTIMATOR_OPTIONS.length;

  return (
    <section
      id="estimator"
      className={styles.section}
      aria-labelledby="estimator-heading"
    >
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <p className={styles.eyebrow}>INSTANT ESTIMATION</p>
          <h2 id="estimator-heading" className={styles.title}>
            Custom Service Cost Estimator
          </h2>
          <p className={styles.description}>
            Select the elements you need for a ballpark budget overview. Final
            pricing adjusts based on guest count, custom themes, and venue size.
          </p>
        </div>

        {/* 2-Column Estimator Layout */}
        <div className={styles.grid}>
          {/* Left: Interactive Service Option Cards */}
          <div
            className={styles.optionsList}
            role="group"
            aria-label="Select celebration services"
          >
            {ESTIMATOR_OPTIONS.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <label
                  key={option.id}
                  htmlFor={`est-${option.id}`}
                  className={`${styles.optionCard} ${
                    isSelected ? styles.optionCardSelected : ""
                  }`}
                >
                  <div className={styles.checkboxContainer}>
                    <input
                      type="checkbox"
                      id={`est-${option.id}`}
                      checked={isSelected}
                      onChange={() => toggleOption(option.id)}
                      className={styles.checkbox}
                    />
                    <span
                      className={`${styles.customCheck} ${
                        isSelected ? styles.customCheckActive : ""
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected && (
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

                  <div className={styles.optionContent}>
                    <span className={styles.optionName}>{option.name}</span>
                    <span className={styles.optionPrice}>
                      {option.displayPrice}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Right: Live Quotation Summary Card */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <span className={styles.summaryEyebrow}>ESTIMATED BUDGET</span>
              <span className={styles.badge}>
                {selectedCount} of {totalCount} selected
              </span>
            </div>

            <div className={styles.totalDisplay}>
              <span className={styles.totalLabel}>Ballpark Total</span>
              <div className={styles.totalAmount}>{formattedTotal}</div>
            </div>

            {selectedCount === 0 ? (
              <p className={styles.emptyNote}>
                Select one or more services above to see an instant estimate.
              </p>
            ) : (
              <p className={styles.activeNote}>
                Based on standard configurations for your selected services.
              </p>
            )}

            <div className={styles.divider} />

            <Link href="/#plan-event" className={styles.ctaButton}>
              Get Confirmed Quote
            </Link>

            <p className={styles.disclaimer}>
              Estimates are indicative and inclusive of basic setup, vendor
              coordination, and applicable taxes. Final quote tailored to your
              exact venue and guest count.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
