import Link from "next/link";
import PackageCustomizer from "./PackageCustomizer";
import styles from "./Packages.module.css";

export default function Packages() {
  return (
    <section
      id="estimate-your-celebration"
      className={styles.section}
      aria-labelledby="estimate-your-celebration-heading"
    >
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <p className={styles.eyebrow}>ESTIMATE YOUR CELEBRATION</p>
          <h2 id="estimate-your-celebration-heading" className={styles.title}>
            Decor Package &amp; Optional Services
          </h2>
          <p className={styles.description}>
            Each package includes decor only, priced per guest. Add optional services such as food, floral styling or photography at the published per-guest rate for your package.
          </p>
        </div>

        {/* Live estimator; uses the default (Premium) tier */}
        <PackageCustomizer embedded={true} />

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
