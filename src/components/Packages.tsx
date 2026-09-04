"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  PACKAGES_CONFIG,
  DEFAULT_PACKAGE_ID,
  type PackageTierConfig,
} from "@/lib/packages-config";
import PackageCustomizer from "./PackageCustomizer";
import styles from "./Packages.module.css";

interface HomePackagePresentation {
  number: string;
  image: string;
  description: string;
}

const HOME_PACKAGE_PRESENTATION: Record<
  PackageTierConfig["id"],
  HomePackagePresentation
> = {
  essential: {
    number: "01",
    image: "/images/packages/living-room-dinner.webp",
    description:
      "For intimate gatherings where you need the important details brought together beautifully.",
  },
  signature: {
    number: "02",
    image: "/images/packages/driveway-lawns.webp",
    description:
      "For celebrations where every detail matters and you want a dedicated team bringing the entire experience together.",
  },
  grand: {
    number: "03",
    image: "/images/packages/grand-celebration.webp",
    description:
      "For larger or more elaborate occasions that need complete planning, coordination, and execution.",
  },
};

export default function Packages() {
  const [selectedPackageId, setSelectedPackageId] =
    useState<PackageTierConfig["id"]>(DEFAULT_PACKAGE_ID);

  return (
    <section
      id="packages"
      className={styles.section}
      aria-labelledby="packages-heading"
    >
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <p className={styles.eyebrow}>PACKAGES</p>
          <h2 id="packages-heading" className={styles.title}>
            Thoughtfully planned, beautifully delivered.
          </h2>
          <p className={styles.description}>
            Choose the level of support that feels right for your celebration.
            Every package can be tailored to your occasion.
          </p>
        </div>

        {/* Packages Cards Grid - Primary Interactive Package Selector */}
        <div
          className={styles.grid}
          role="radiogroup"
          aria-label="Select celebration package"
        >
          {PACKAGES_CONFIG.map((pkg) => {
            const meta = HOME_PACKAGE_PRESENTATION[pkg.id];
            const isSelected = selectedPackageId === pkg.id;
            const isSignature = pkg.id === "signature";

            const handleSelect = () => {
              setSelectedPackageId(pkg.id);
            };

            const handleKeyDown = (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedPackageId(pkg.id);
              }
            };

            return (
              <div
                key={pkg.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={handleSelect}
                onKeyDown={handleKeyDown}
                aria-label={`${pkg.name} Package — ${pkg.displayRate}`}
                className={`${styles.card} ${
                  isSignature ? styles.signatureCard : ""
                } ${isSelected ? styles.cardSelected : ""}`}
              >
                {pkg.badge && (
                  <span className={styles.signatureBadge}>{pkg.badge}</span>
                )}

                <div>
                  {meta.image && (
                    <div className={styles.imageWrapper}>
                      <Image
                        src={meta.image}
                        alt={pkg.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className={styles.cardImage}
                      />
                    </div>
                  )}

                  <div className={styles.cardHeader}>
                    <span className={styles.packageNumber}>{meta.number}</span>
                    <h3 className={styles.packageName}>{pkg.name}</h3>
                    <span className={styles.packageRate}>{pkg.displayRate}</span>
                    <p className={styles.packageTagline}>{pkg.tagline}</p>
                    <p className={styles.packageDescription}>
                      {meta.description}
                    </p>
                  </div>

                  <div className={styles.divider} />

                  <ul className={styles.featureList}>
                    {pkg.features.map((feature) => (
                      <li key={feature} className={styles.featureItem}>
                        <svg
                          className={styles.checkIcon}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={styles.cardFooter}>
                  <p className={styles.pricingNote}>
                    Tailored to your occasion
                  </p>
                  <div
                    className={`${styles.selectIndicator} ${
                      isSelected ? styles.selectIndicatorActive : ""
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected ? "✓ Selected" : `Select ${pkg.name}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Embedded Live Estimator directly connected to selected card */}
        <PackageCustomizer
          embedded={true}
          selectedPackageId={selectedPackageId}
          onPackageSelect={setSelectedPackageId}
        />

        {/* Secondary Comparison CTA */}
        <div className={styles.secondaryCtaContainer}>
          <Link href="/packages" className={styles.secondaryCta}>
            Compare All Packages &amp; Customizer →
          </Link>
        </div>
      </div>
    </section>
  );
}
