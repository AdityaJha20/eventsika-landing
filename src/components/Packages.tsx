import Link from "next/link";
import styles from "./Packages.module.css";

const PACKAGES = [
  {
    number: "01",
    name: "ESSENTIAL",
    tagline: "Simple celebrations, thoughtfully arranged.",
    description:
      "For intimate gatherings where you need the important details brought together beautifully.",
    features: [
      "Event planning consultation",
      "Venue & decor coordination",
      "Essential vendor coordination",
      "Event-day guidance",
    ],
    ctaText: "Explore Essential",
    ctaHref: "#plan-event",
    isSignature: false,
  },
  {
    number: "02",
    name: "SIGNATURE",
    badge: "OUR SIGNATURE",
    tagline: "Everything comes together beautifully.",
    description:
      "For celebrations where every detail matters and you want a dedicated team bringing the entire experience together.",
    features: [
      "Complete event planning",
      "Venue & decor coordination",
      "Catering coordination",
      "Photography & films coordination",
      "Entertainment coordination",
      "Event-day management",
    ],
    ctaText: "Plan With Signature",
    ctaHref: "#plan-event",
    isSignature: true,
  },
  {
    number: "03",
    name: "GRAND",
    tagline: "Complete planning, from idea to celebration.",
    description:
      "For larger or more elaborate occasions that need complete planning, coordination, and execution.",
    features: [
      "Full event management",
      "Premium venue & decor planning",
      "Catering & hospitality coordination",
      "Photography & films",
      "Entertainment & production",
      "Guest experience coordination",
      "Complete event-day execution",
    ],
    ctaText: "Plan a Grand Celebration",
    ctaHref: "#plan-event",
    isSignature: false,
  },
];

export default function Packages() {
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

        {/* Packages Cards Grid */}
        <ul className={styles.grid}>
          {PACKAGES.map((pkg) => (
            <li
              key={pkg.number}
              className={`${styles.card} ${
                pkg.isSignature ? styles.signatureCard : ""
              }`}
            >
              {pkg.badge && (
                <span className={styles.signatureBadge}>{pkg.badge}</span>
              )}

              <div>
                <div className={styles.cardHeader}>
                  <span className={styles.packageNumber}>{pkg.number}</span>
                  <h3 className={styles.packageName}>{pkg.name}</h3>
                  <p className={styles.packageTagline}>{pkg.tagline}</p>
                  <p className={styles.packageDescription}>{pkg.description}</p>
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
                <Link
                  href={pkg.ctaHref}
                  className={`${styles.ctaButton} ${
                    pkg.isSignature ? styles.signatureCta : ""
                  }`}
                >
                  {pkg.ctaText}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
