import { Fragment } from "react";
import styles from "./PackageComparison.module.css";

interface ComparisonItem {
  feature: string;
  essential: string;
  signature: string;
  grand: string;
}

interface ComparisonCategory {
  category: string;
  rows: ComparisonItem[];
}

const COMPARISON_DATA: ComparisonCategory[] = [
  {
    category: "Capacity & Scale",
    rows: [
      {
        feature: "Recommended Guest Scale",
        essential: "10 to 35 Guests",
        signature: "25 to 100 Guests",
        grand: "75 to 200+ Guests",
      },
      {
        feature: "Ideal Celebration Setting",
        essential: "Cozy home / terrace / living room",
        signature: "Lawns / banquet / terrace / farmhouse",
        grand: "Luxury estate / grand hall / gala grounds",
      },
    ],
  },
  {
    category: "Decor & Floral Styling",
    rows: [
      {
        feature: "Stage / Backdrop Concept",
        essential: "Signature Themed Backdrop or Floral Mandap",
        signature: "Grand Floral Stage + Entrance Toran",
        grand: "Bespoke Architectural Fabrication & Chandeliers",
      },
      {
        feature: "Lighting & Ambient Decor",
        essential: "Warm Fairy Lights & Table Accents",
        signature: "Intelligent Ambient & Party Lighting Rig",
        grand: "Multi-Zone Mood Lighting & Draped Canopies",
      },
    ],
  },
  {
    category: "Catering & Hospitality",
    rows: [
      {
        feature: "Buffet Dining Coordination",
        essential: "Coordination available as add-on",
        signature: "Multi-Course Gourmet Buffet Planning",
        grand: "Curated Live Gourmet Counters & Fusion Dining",
      },
      {
        feature: "Live Food & Mocktails",
        essential: "Optional add-on available",
        signature: "Live Chaat & Refreshment Stations",
        grand: "Multi-Station Experiential Food Bars",
      },
    ],
  },
  {
    category: "Photography & Cinematography",
    rows: [
      {
        feature: "Still Photography",
        essential: "Candid Coverage (3 Hours)",
        signature: "Full Celebration Candid Coverage",
        grand: "Duo Lead Candid + Traditional Coverage",
      },
      {
        feature: "Cinematic Film & Reels",
        essential: "Optional add-on available",
        signature: "4K Cinematic Highlight Reel",
        grand: "Full Cinematography Team + Drone + Teasers",
      },
    ],
  },
  {
    category: "Entertainment & Sound",
    rows: [
      {
        feature: "Music & Sound System",
        essential: "High-Fidelity Bluetooth Sound & Playlist",
        signature: "Professional DJ & Party Sound Setup",
        grand: "Live Acoustic / Sufi Band & Celebrity Host",
      },
    ],
  },
  {
    category: "Coordination & Management",
    rows: [
      {
        feature: "On-Ground Management Team",
        essential: "1 Dedicated On-Site Event Coordinator",
        signature: "1 Lead Floor Manager + 2 Operations Staff",
        grand: "Comprehensive End-to-End Concierge Team",
      },
      {
        feature: "Valet & Guest Hospitality",
        essential: "Optional add-on available",
        signature: "Dedicated Welcome Coordination",
        grand: "Complete Valet, Concierge & Guest Desk",
      },
    ],
  },
  {
    category: "Invitations & Stationery",
    rows: [
      {
        feature: "Digital Invitations",
        essential: "Digital WhatsApp Invitation Design",
        signature: "Animated WhatsApp Video Invitation",
        grand: "Animated Video + Interactive RSVP Microsite",
      },
      {
        feature: "Physical Keepsakes & Favors",
        essential: "Optional add-on available",
        signature: "Coordination available as add-on",
        grand: "Curated Luxury Boxed Keepsake Hampers",
      },
    ],
  },
  {
    category: "Execution & Teardown",
    rows: [
      {
        feature: "Setup & Post-Event Dismantling",
        essential: "✓ Included",
        signature: "✓ Included",
        grand: "✓ Included",
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
        {/* Section Header */}
        <div className={styles.header}>
          <p className={styles.eyebrow}>COMPARE INCLUSIONS</p>
          <h2 id="comparison-heading" className={styles.title}>
            Detailed Inclusions Comparison
          </h2>
          <p className={styles.description}>
            A side-by-side breakdown of features, staffing, and deliverables
            across all three celebration tiers.
          </p>
        </div>

        {/* Comparison Matrix Table */}
        <div
          className={styles.tableScrollContainer}
          tabIndex={0}
          role="region"
          aria-label="Package inclusions comparison table"
        >
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th scope="col" className={styles.featureColHeader}>
                  <span className={styles.headerColTitle}>
                    Deliverables &amp; Inclusions
                  </span>
                </th>
                <th scope="col" className={styles.packageColHeader}>
                  <div className={styles.packageHeaderBox}>
                    <span className={styles.packageName}>Essential</span>
                    <span className={styles.packagePrice}>₹1,500 / guest</span>
                  </div>
                </th>
                <th
                  scope="col"
                  className={`${styles.packageColHeader} ${styles.popularColHeader}`}
                >
                  <div className={styles.packageHeaderBox}>
                    <span className={styles.popularBadge}>OUR SIGNATURE</span>
                    <span className={styles.packageName}>Signature</span>
                    <span className={styles.packagePrice}>₹2,500 / guest</span>
                  </div>
                </th>
                <th scope="col" className={styles.packageColHeader}>
                  <div className={styles.packageHeaderBox}>
                    <span className={styles.packageName}>Grand</span>
                    <span className={styles.packagePrice}>₹3,500 / guest</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_DATA.map((catGroup) => (
                <Fragment key={catGroup.category}>
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
                      <td className={styles.dataCell}>
                        {row.essential === "✓ Included" ? (
                          <span className={styles.checkValue}>
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
                            <span>Included</span>
                          </span>
                        ) : row.essential === "—" ? (
                          <span className={styles.dashValue}>—</span>
                        ) : (
                          <span>{row.essential}</span>
                        )}
                      </td>
                      <td
                        className={`${styles.dataCell} ${styles.popularDataCell}`}
                      >
                        {row.signature === "✓ Included" ? (
                          <span className={styles.checkValue}>
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
                            <span>Included</span>
                          </span>
                        ) : row.signature === "—" ? (
                          <span className={styles.dashValue}>—</span>
                        ) : (
                          <span>{row.signature}</span>
                        )}
                      </td>
                      <td className={styles.dataCell}>
                        {row.grand === "✓ Included" ? (
                          <span className={styles.checkValue}>
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
                            <span>Included</span>
                          </span>
                        ) : row.grand === "—" ? (
                          <span className={styles.dashValue}>—</span>
                        ) : (
                          <span>{row.grand}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
