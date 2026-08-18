import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PackageCustomizer from "@/components/PackageCustomizer";
import PackageComparison from "@/components/PackageComparison";
import Footer from "@/components/Footer";
import styles from "./packages.module.css";

export const metadata: Metadata = {
  title: "Packages | Transparent Celebration Pricing",
  description:
    "Explore thoughtfully structured celebration tiers designed for transparent budgeting. Select a curated foundation or customize every detail to match your vision.",
  alternates: {
    canonical: "/packages",
  },
};

interface PackageTier {
  id: string;
  name: string;
  guestRange: string;
  price: string;
  badge?: string;
  description: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
  isPopular?: boolean;
}

const PACKAGE_TIERS: PackageTier[] = [
  {
    id: "intimate-soiree",
    name: "Intimate Soirée",
    guestRange: "10 TO 35 GUESTS",
    price: "Starting at ₹45,000",
    description:
      "Designed for cozy apartment living rooms, terraces, and intimate family milestone dinners.",
    features: [
      "Signature Floral Backdrop or Mandap Styling",
      "Ambient Fairy Lights & Diwan Floor Cushions",
      "Candid Photography Coverage (3 Hours)",
      "High-Fidelity Bluetooth Sound System & Curated Playlist",
      "1 Dedicated On-Site Event Coordinator",
      "Digital WhatsApp Invitation Design",
      "Complete Setup & Post-Event Dismantling",
    ],
    ctaText: "Select Intimate Soirée",
    ctaHref: "/#plan-event",
    isPopular: false,
  },
  {
    id: "grand-utsav",
    name: "Grand Utsav",
    guestRange: "50 TO 120 GUESTS",
    price: "Starting at ₹1,25,000",
    badge: "MOST POPULAR",
    description:
      "Our most popular all-in-one celebration package with signature decor, catering, DJ, and full management.",
    features: [
      "Grand Entrance Toran + Themed Floral & Fabric Stage",
      "Multi-Course Gourmet Buffet Catering (50 Guests Included)",
      "Live Chaat / Mocktail Corner with Uniformed Staff",
      "Candid Photography + Cinematic 4K Highlight Video",
      "Professional DJ, Party Sound & Intelligent Lighting Rig",
      "Lead Floor Manager + 2 On-Ground Operations Staff",
    ],
    ctaText: "Select Grand Utsav",
    ctaHref: "/#plan-event",
    isPopular: true,
  },
  {
    id: "royal-bespoke",
    name: "Royal Bespoke",
    guestRange: "120+ GUESTS",
    price: "Starting at ₹3,25,000",
    description:
      "Luxury full-scale transformation for milestone anniversaries, grand housewarmings, and pre-wedding soirees.",
    features: [
      "Custom Architectural Fabrication, Flower Chandeliers & Draped Canopies",
      "Live Gourmet Counter Showcase (Indian, Continental, Artisanal Desserts)",
      "Full Cinematography Team with Drone & Candid Duo",
      "Live Sufi / Acoustic Fusion Band & Celebrity Anchor",
      "Complete Guest Concierge, Valet Management & Luggage Assistance",
      "Luxury Boxed Physical Keepsake Invites + Favors",
      "Comprehensive End-to-End Execution Team",
      "Animated Video WhatsApp Invitation & RSVP Microsite",
    ],
    ctaText: "Select Royal Bespoke",
    ctaHref: "/#plan-event",
    isPopular: false,
  },
];

const packagesJsonLd = {
  "@context": "https://schema.org",
  "@type": "OfferCatalog",
  name: "Eventsika Celebration Packages",
  description:
    "Thoughtfully structured celebration tiers designed for transparent budgeting for Indian celebrations at home.",
  itemListElement: [
    {
      "@type": "Offer",
      name: "Intimate Soirée",
      description:
        "Designed for cozy apartment living rooms, terraces, and intimate family milestone dinners. (10 to 35 guests).",
      price: 45000,
      priceCurrency: "INR",
      url: "https://eventsika.in/packages#intimate-soiree",
      itemOffered: {
        "@type": "Service",
        name: "Intimate Soirée Celebration Package",
        description:
          "Includes signature floral styling, ambient fairy lights, candid photography coverage (3 hours), sound system, on-site coordinator, and WhatsApp invitation design.",
        provider: {
          "@type": "Organization",
          name: "Eventsika",
          url: "https://eventsika.in",
        },
      },
    },
    {
      "@type": "Offer",
      name: "Grand Utsav",
      description:
        "Our most popular all-in-one celebration package with signature decor, catering, DJ, and full management. (50 to 120 guests).",
      price: 125000,
      priceCurrency: "INR",
      url: "https://eventsika.in/packages#grand-utsav",
      itemOffered: {
        "@type": "Service",
        name: "Grand Utsav Celebration Package",
        description:
          "Includes entrance toran, themed floral & fabric stage, multi-course buffet catering for 50 guests, live chaat/mocktail corner, candid photography & 4K video, DJ & lighting rig, and floor management.",
        provider: {
          "@type": "Organization",
          name: "Eventsika",
          url: "https://eventsika.in",
        },
      },
    },
    {
      "@type": "Offer",
      name: "Royal Bespoke",
      description:
        "Luxury full-scale transformation for milestone anniversaries, grand housewarmings, and pre-wedding soirees. (120+ guests).",
      price: 325000,
      priceCurrency: "INR",
      url: "https://eventsika.in/packages#royal-bespoke",
      itemOffered: {
        "@type": "Service",
        name: "Royal Bespoke Celebration Package",
        description:
          "Includes custom architectural fabrication, live gourmet counter showcase, full cinematography team with drone, live fusion band & celebrity anchor, valet & guest concierge, and keepsake invitations.",
        provider: {
          "@type": "Organization",
          name: "Eventsika",
          url: "https://eventsika.in",
        },
      },
    },
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://eventsika.in/",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Packages",
      item: "https://eventsika.in/packages",
    },
  ],
};

export default function PackagesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(packagesJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
      <Navbar />
      <main id="main-content">
        {/* Packages Hero Section */}
        <section
          className={styles.heroSection}
          aria-labelledby="packages-hero-heading"
        >
          <div className={styles.container}>
            <p className={styles.eyebrow}>OUR PACKAGES</p>
            <h1 id="packages-hero-heading" className={styles.title}>
              Transparent Celebration Pricing
            </h1>
            <p className={styles.description}>
              Choose the level of support that feels right for your
              celebration. Every package can be tailored to your occasion.
            </p>
          </div>
        </section>

        {/* Packages Grid Section */}
        <section
          className={styles.tiersSection}
          aria-labelledby="packages-tier-heading"
        >
          <div className={styles.tiersContainer}>
            <h2 id="packages-tier-heading" className={styles.srOnly}>
              Celebration Package Tiers
            </h2>

            <ul className={styles.grid}>
              {PACKAGE_TIERS.map((pkg) => (
                <li
                  key={pkg.id}
                  className={`${styles.card} ${
                    pkg.isPopular ? styles.popularCard : ""
                  }`}
                >
                  {pkg.badge && (
                    <div className={styles.badgeWrapper}>
                      <span className={styles.popularBadge}>{pkg.badge}</span>
                    </div>
                  )}

                  <div className={styles.cardHeader}>
                    <span className={styles.guestRange}>{pkg.guestRange}</span>
                    <h3 className={styles.packageName}>{pkg.name}</h3>
                    <div className={styles.priceTag}>{pkg.price}</div>
                    <p className={styles.packageDescription}>
                      {pkg.description}
                    </p>
                  </div>

                  <div className={styles.divider} />

                  <div className={styles.featuresSection}>
                    <p className={styles.featuresTitle}>What&apos;s Included:</p>
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
                    <Link
                      href={pkg.ctaHref}
                      className={`${styles.ctaButton} ${
                        pkg.isPopular ? styles.popularCta : ""
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

        {/* Live Package Customizer */}
        <PackageCustomizer />

        {/* Detailed Inclusions Comparison */}
        <PackageComparison />
      </main>
      <Footer />
    </>
  );
}
