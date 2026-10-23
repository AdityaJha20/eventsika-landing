"use client";

import { Fragment } from "react";
import styles from "./PackageComparison.module.css";
import {
  PACKAGES_CONFIG,
  formatPackageRate,
  type PackageTierConfig,
} from "@/lib/packages-config";

interface ComparisonItem {
  feature: string;
  values: Record<PackageTierConfig["id"], string>;
}

interface ComparisonCategory {
  category: string;
  rows: ComparisonItem[];
}

const COMPARISON_DATA: ComparisonCategory[] = [
  {
    category: "Planning & Discovery",
    rows: [
      {
        feature: "Initial event brief and planning kickoff",
        values: { essential: "Included", premium: "Included", luxury: "Included" },
      },
      {
        feature: "Planning and budget guidance",
        values: {
          essential: "Core checklist and priorities",
          premium: "Detailed plan and budget coordination",
          luxury: "Comprehensive planning and budget coordination",
        },
      },
      {
        feature: "Planning complexity",
        values: {
          essential: "Intimate, straightforward celebrations",
          premium: "Detailed, multi-part celebrations",
          luxury: "Complex celebrations with broader coordination needs",
        },
      },
    ],
  },
  {
    category: "Vendor Discovery & Coordination",
    rows: [
      {
        feature: "Vendor recommendations",
        values: {
          essential: "Essential vendor recommendations",
          premium: "Curated shortlist across agreed categories",
          luxury: "Broader vendor discovery and coordination",
        },
      },
      {
        feature: "Third-party vendor communication",
        values: {
          essential: "Essential coordination",
          premium: "Coordination across agreed service categories",
          luxury: "Expanded multi-vendor coordination",
        },
      },
      {
        feature: "Decor, catering, photography, entertainment, equipment and staffing",
        values: {
          essential: "Vendor service costs quoted separately",
          premium: "Vendor service costs quoted separately",
          luxury: "Vendor service costs quoted separately",
        },
      },
    ],
  },
  {
    category: "Schedule & Event-Day Support",
    rows: [
      {
        feature: "Event planning checklist",
        values: {
          essential: "Core checklist",
          premium: "Detailed planning checklist",
          luxury: "Comprehensive planning checklist",
        },
      },
      {
        feature: "Run-of-show / event timeline",
        values: {
          essential: "Timeline guidance",
          premium: "Detailed run-of-show",
          luxury: "Comprehensive run-of-show and contingency coordination",
        },
      },
      {
        feature: "Event-day coordination scope",
        values: {
          essential: "Guidance and checklist",
          premium: "Coordination oversight within agreed scope",
          luxury: "Expanded coordination oversight within agreed scope",
        },
      },
    ],
  },
  {
    category: "Commercial Clarity",
    rows: [
      {
        feature: "Eventsika planning fee",
        values: {
          essential: "Per person, based on guest count",
          premium: "Per person, based on guest count",
          luxury: "Per person, based on guest count",
        },
      },
      {
        feature: "Vendor estimate treatment",
        values: {
          essential: "Indicative until vendor-confirmed",
          premium: "Indicative until vendor-confirmed",
          luxury: "Indicative until vendor-confirmed",
        },
      },
      {
        feature: "Final proposal",
        values: {
          essential: "Confirms scope and pricing",
          premium: "Confirms scope and pricing",
          luxury: "Confirms scope and pricing",
        },
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
          <p className={styles.eyebrow}>COMPARE PLANNING SUPPORT</p>
          <h2 id="comparison-heading" className={styles.title}>
            Detailed Package Comparison
          </h2>
          <p className={styles.description}>
            Compare planning and coordination support. Vendor services such as
            food, decor, photography, entertainment, equipment and staffing are
            quoted separately; displayed vendor estimates are indicative.
          </p>
        </div>

        <div
          className={styles.tableScrollContainer}
          tabIndex={0}
          role="region"
          aria-label="Planning package comparison table"
        >
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th scope="col" className={styles.featureColHeader}>
                  <span className={styles.headerColTitle}>Planning Scope</span>
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
