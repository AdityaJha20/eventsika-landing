import Image from "next/image";
import {
  PACKAGES_CONFIG,
  BASE_PACKAGE_INCLUSION,
  formatPackageRate,
  type PackageTierId,
} from "@/lib/packages-config";
import styles from "./PackageShowcase.module.css";

interface PackagePresentation {
  number: string;
  image: string;
  description: string;
}

// Editorial presentation previously used on the homepage; pricing stays in packages-config.
const PACKAGE_PRESENTATION: Record<PackageTierId, PackagePresentation> = {
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

export default function PackageShowcase() {
  return (
    <section
      id="packages"
      className={styles.section}
      aria-labelledby="packages-heading"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>PACKAGES</p>
          <h2 id="packages-heading" className={styles.title}>
            Thoughtfully planned, beautifully delivered.
          </h2>
          <p className={styles.description}>
            Each package includes decor only, priced per guest. Add optional services such as food, floral styling or photography at the published per-guest rate for your package.
          </p>
        </div>

        <ul className={styles.grid}>
          {PACKAGES_CONFIG.map((pkg) => {
            const meta = PACKAGE_PRESENTATION[pkg.id];
            return (
              <li
                key={pkg.id}
                className={`${styles.card} ${pkg.badge ? styles.premiumCard : ""}`}
              >
                {pkg.badge && (
                  <span className={styles.signatureBadge}>{pkg.badge}</span>
                )}

                <div className={styles.imageWrapper}>
                  <Image
                    src={meta.image}
                    alt={`${pkg.name} decor package`}
                    fill
                    sizes="(max-width: 1024px) 560px, 33vw"
                    className={styles.cardImage}
                  />
                </div>

                <div className={styles.cardHeader}>
                  <span className={styles.packageNumber}>{meta.number}</span>
                  <h3 className={styles.packageName}>{pkg.name}</h3>
                  <span className={styles.packageRate}>
                    {formatPackageRate(pkg.pricePerPerson)}
                  </span>
                  <span className={styles.packageInclusion}>
                    Includes: {BASE_PACKAGE_INCLUSION}
                  </span>
                  <p className={styles.packageTagline}>{pkg.tagline}</p>
                  <p className={styles.packageDescription}>{meta.description}</p>
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
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
