"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  PACKAGES_CONFIG,
  DEFAULT_PACKAGE_ID,
  BASE_PACKAGE_INCLUSION,
  formatPackageRate,
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
      "For intimate gatherings that call for a warm, well-considered decor setting.",
  },
  premium: {
    number: "02",
    image: "/images/packages/driveway-lawns.webp",
    description:
      "For celebrations with more spaces and moments to dress, styled in richer detail.",
  },
  luxury: {
    number: "03",
    image: "/images/packages/grand-celebration.webp",
    description:
      "For milestone occasions that deserve our most elaborate decor treatment.",
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
            Each package includes decor only, priced per guest. Add optional services such as food, floral styling or photography at the published per-guest rate for your package.
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
            const isPremium = pkg.id === "premium";

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
                aria-label={`${pkg.name} Decor Package — ${formatPackageRate(pkg.pricePerPerson)}`}
                className={`${styles.card} ${
                  isPremium ? styles.premiumCard : ""
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
                    <span className={styles.packageRate}>{formatPackageRate(pkg.pricePerPerson)}</span>
                    <span className={styles.packageInclusion}>
                      Includes: {BASE_PACKAGE_INCLUSION}
                    </span>
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
