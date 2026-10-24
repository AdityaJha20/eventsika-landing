"use client";

import styles from "./PackageComparison.module.css";
import {
  PACKAGES_CONFIG,
  OPTIONAL_SERVICES_CONFIG,
  BASE_PACKAGE_INCLUSION,
  formatPackageRate,
  formatPerPersonRate,
  getPackageTier,
  type PackageTierId,
} from "@/lib/packages-config";

interface ComparisonItem {
  feature: string;
  values: Record<PackageTierId, string>;
}

interface ComparisonCategory {
  category: string;
  rows: ComparisonItem[];
}

function valuesByTier(
  valueFor: (tierId: PackageTierId) => string
): Record<PackageTierId, string> {
  return {
    essential: valueFor("essential"),
    premium: valueFor("premium"),
    luxury: valueFor("luxury"),
  };
}

function sameForEveryTier(value: string): Record<PackageTierId, string> {
  return valuesByTier(() => value);
}

const COMPARISON_DATA: ComparisonCategory[] = [
  {
    category: "Included in Every Base Package",
    rows: [
      {
        feature: "Decor",
        values: sameForEveryTier("Included"),
      },
      {
        feature: "Decor package rate",
        values: valuesByTier((tierId) =>
          formatPerPersonRate(getPackageTier(tierId).pricePerPerson)
        ),
      },
    ],
  },
  {
    category: "Optional Services — Charged Per Guest Only When Selected",
    rows: OPTIONAL_SERVICES_CONFIG.map((service) => ({
      feature: service.name,
      values: valuesByTier(
        (tierId) => `Optional · ${formatPerPersonRate(service.ratesPerPerson[tierId])}`
      ),
    })),
  },
  {
    category: "How Your Estimate Works",
    rows: [
      {
        feature: "Per-person total",
        values: sameForEveryTier("Decor rate + selected service rates"),
      },
      {
        feature: "Indicative event estimate",
        values: sameForEveryTier("Guest count × per-person total"),
      },
      {
        feature: "Final quote",
        values: sameForEveryTier(
          "Confirms supplier availability, scope and tax treatment"
        ),
      },
    ],
  },
];

export default function PackageComparison() {
  return (
    <section
      id="comparison"
      className={styles.section}
      aria-labelledby="comparison-heading"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>COMPARE PACKAGES</p>
          <h2 id="comparison-heading" className={styles.title}>
            Detailed Package Comparison
          </h2>
          <p className={styles.description}>
            Every base package includes decor only. Food, floral styling,
            bartending, housekeeping, valet, light &amp; sound, photography and
            videography are optional and charged per guest at the rate for
            your chosen package, only when you select them.
          </p>
        </div>

        <div
          className={styles.tableScrollContainer}
          tabIndex={0}
          role="region"
          aria-label="Decor package and optional service comparison table"
        >
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th scope="col" className={styles.featureColHeader}>
                  <span className={styles.headerColTitle}>Package &amp; Services</span>
                </th>
                {PACKAGES_CONFIG.map((pkg) => (
                  <th
                    key={pkg.id}
                    scope="col"
                    className={
                      pkg.id === "premium"
                        ? styles.popularColHeader + " " + styles.packageColHeader
                        : styles.packageColHeader
                    }
                  >
                    <div className={styles.packageHeaderBox}>
                      {pkg.badge && (
                        <span className={styles.popularBadge}>{pkg.badge}</span>
                      )}
                      <span className={styles.packageName}>{pkg.name}</span>
                      <span className={styles.packagePrice}>
                        {formatPackageRate(pkg.pricePerPerson)}
                      </span>
                      <span className={styles.packageInclusion}>
                        Includes: {BASE_PACKAGE_INCLUSION}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARISON_DATA.map((catGroup) => (
              <tbody key={catGroup.category}>
                <tr className={styles.categoryRow}>
                  <th
                    colSpan={4}
                    scope="colgroup"
                    className={styles.categoryHeader}
                  >
                    {catGroup.category}
                  </th>
                </tr>
                {catGroup.rows.map((row) => (
                  <tr key={row.feature} className={styles.dataRow}>
                    <th scope="row" className={styles.featureCell}>
                      {row.feature}
                    </th>
                    {PACKAGES_CONFIG.map((pkg) => (
                      <td
                        key={pkg.id}
                        className={
                          pkg.id === "premium"
                            ? styles.dataCell + " " + styles.popularDataCell
                            : styles.dataCell
                        }
                      >
                        {row.values[pkg.id]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  );
}
