import { Fragment } from "react";
import styles from "./PackageComparison.module.css";

interface ComparisonItem {
  feature: string;
  intimate: string;
  grand: string;
  royal: string;
}

interface ComparisonCategory {
  category: string;
  rows: ComparisonItem[];
}

const COMPARISON_DATA: ComparisonCategory[] = [
  {
    category: "Capacity & Venue",
    rows: [
      {
        feature: "Target Guest Range",
        intimate: "10 to 35 Guests",
        grand: "50 to 120 Guests",
        royal: "120+ Guests",
      },
      {
        feature: "Ideal Setting",
        intimate: "Cozy home / terrace",
        grand: "Banquet hall / lawn",
        royal: "Luxury estate / gala",
      },
    ],
  },
  {
    category: "Decor & Styling",
    rows: [
      {
        feature: "Stage / Floral Concept",
        intimate: "Signature Backdrop / Mandap",
        grand: "Grand Stage + Entrance Toran",
        royal: "Architectural Fabrication & Chandeliers",
      },
      {
        feature: "Lighting & Seating",
        intimate: "Fairy Lights & Diwan Seating",
        grand: "Intelligent Party Lighting Rig",
        royal: "Draped Canopies & Architectural Lighting",
      },
    ],
  },
  {
    category: "Catering",
    rows: [
      {
        feature: "Buffet Dining",
        intimate: "— (Add-on available)",
        grand: "Multi-Course Buffet (50 Guests)",
        royal: "Live Gourmet Showcase & Multi-Cuisine",
      },
      {
        feature: "Live Counter / Chaat",
        intimate: "—",
        grand: "Live Chaat & Mocktail Corner",
        royal: "Multi-Station Experiential Bars",
      },
    ],
  },
  {
    category: "Photo & Cinema",
    rows: [
      {
        feature: "Photography",
        intimate: "Candid Coverage (3 Hours)",
        grand: "Full Event Candid Photographer",
        royal: "Duo Candid + Lead Traditional",
      },
      {
        feature: "Cinematic Video & Reel",
        intimate: "—",
        grand: "4K Cinematic Highlight Reel",
        royal: "Full Film Crew + Drone + Teaser",
      },
    ],
  },
  {
    category: "Entertainment",
    rows: [
      {
        feature: "Music / DJ",
        intimate: "Hi-Fi Bluetooth & Playlist",
        grand: "Professional DJ & Sound Rig",
        royal: "Live Sufi/Acoustic Band & Host",
      },
    ],
  },
  {
    category: "Management",
    rows: [
      {
        feature: "On-Ground Operations",
        intimate: "1 On-Site Coordinator",
        grand: "1 Lead Manager + 2 Staff",
        royal: "Comprehensive Execution Team",
      },
      {
        feature: "Valet & Guest Concierge",
        intimate: "—",
        grand: "— (Add-on available)",
        royal: "Complete Valet & Concierge Desk",
      },
    ],
  },
  {
    category: "Invites & Details",
    rows: [
      {
        feature: "Invitation Format",
        intimate: "Digital WhatsApp Invite",
        grand: "Digital Video WhatsApp Invite",
        royal: "Animated Video + RSVP Microsite",
      },
      {
        feature: "Physical Favors / Boxes",
        intimate: "—",
        grand: "— (Add-on available)",
        royal: "Luxury Boxed Keepsake Hampers",
      },
    ],
  },
  {
    category: "Setup",
    rows: [
      {
        feature: "Setup & Post-Dismantling",
        intimate: "✓ Included",
        grand: "✓ Included",
        royal: "✓ Included",
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
                    <span className={styles.packageName}>Intimate Soirée</span>
                    <span className={styles.packagePrice}>₹45,000</span>
                  </div>
                </th>
                <th
                  scope="col"
                  className={`${styles.packageColHeader} ${styles.popularColHeader}`}
                >
                  <div className={styles.packageHeaderBox}>
                    <span className={styles.popularBadge}>MOST POPULAR</span>
                    <span className={styles.packageName}>Grand Utsav</span>
                    <span className={styles.packagePrice}>₹1,25,000</span>
                  </div>
                </th>
                <th scope="col" className={styles.packageColHeader}>
                  <div className={styles.packageHeaderBox}>
                    <span className={styles.packageName}>Royal Bespoke</span>
                    <span className={styles.packagePrice}>₹3,25,000</span>
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
                        {row.intimate === "✓ Included" ? (
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
                        ) : row.intimate === "—" ? (
                          <span className={styles.dashValue}>—</span>
                        ) : (
                          <span>{row.intimate}</span>
                        )}
                      </td>
                      <td
                        className={`${styles.dataCell} ${styles.popularDataCell}`}
                      >
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
                      <td className={styles.dataCell}>
                        {row.royal === "✓ Included" ? (
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
                        ) : row.royal === "—" ? (
                          <span className={styles.dashValue}>—</span>
                        ) : (
                          <span>{row.royal}</span>
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
