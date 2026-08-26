import type { Metadata } from "next";
import Image from "next/image";
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
  image?: string;
}

const PACKAGE_TIERS: PackageTier[] = [
  {
    id: "balcony-terrace",
    name: "Balcony / Terrace",
    guestRange: "10 TO 30 GUESTS",
    price: "Starting at ₹35,000",
    image: "/images/packages/balcony-terrace.jpg",
    description:
      "Open-air ambient styling with warm fairy lighting, cozy floor cushions, and intimate terrace decor.",
    features: [
      "Signature Floral Canopy & Fairy Light Mesh",
      "Low Diwan Seating & Floor Cushions Setup",
      "High-Fidelity Bluetooth Sound System & Playlist",
      "Ambient Brass Lanterns & Marigold Accents",
      "1 Dedicated On-Site Event Coordinator",
      "Digital WhatsApp Invitation Design",
      "Complete Setup & Post-Event Dismantling",
    ],
    ctaText: "Select Balcony / Terrace",
    ctaHref: "/#plan-event",
    isPopular: false,
  },
  {
    id: "driveway-lawns",
    name: "Driveway / Lawns",
    guestRange: "50 TO 120 GUESTS",
    price: "Starting at ₹1,25,000",
    badge: "MOST POPULAR",
    image: "/images/packages/driveway-lawns.jpg",
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
    ctaText: "Select Driveway / Lawns",
    ctaHref: "/#plan-event",
    isPopular: true,
  },
  {
    id: "living-rooms-dinner",
    name: "Living Rooms / Family Dinner",
    guestRange: "10 TO 35 GUESTS",
    price: "Starting at ₹45,000",
    image: "/images/packages/living-room-dinner.jpg",
    description:
      "Designed for cozy apartment living rooms, family dinners, and intimate milestone gatherings at home.",
    features: [
      "Signature Floral Backdrop or Mandap Styling",
      "Ambient Fairy Lights & Dining Table Centerpieces",
      "Candid Photography Coverage (3 Hours)",
      "High-Fidelity Bluetooth Sound System & Playlist",
      "1 Dedicated On-Site Event Coordinator",
      "Digital WhatsApp Invitation Design",
      "Complete Setup & Post-Event Dismantling",
    ],
    ctaText: "Select Living Rooms / Dinner",
    ctaHref: "/#plan-event",
    isPopular: false,
  },
  {
    id: "showrooms-offices",
    name: "Showrooms / Offices",
    guestRange: "25 TO 100+ GUESTS",
    price: "Starting at ₹65,000",
    image: "/images/packages/showroom-office.jpg",
    description:
      "Sophisticated corporate celebrations, brand launches, or office milestone events with sleek modern decor.",
    features: [
      "Modern Corporate Stage & Backdrop Branding",
      "Artisanal High-Tea & Finger Food Catering",
      "Professional AV, Microphones & Ambient Lighting",
      "Corporate Event Photography & Highlight Reel",
      "Dedicated On-Site Floor Management Team",
      "Welcome Desk & Registration Setup Assistance",
    ],
    ctaText: "Select Showrooms / Offices",
    ctaHref: "/#plan-event",
    isPopular: false,
  },
  {
    id: "grand-celebrations",
    name: "Grand Celebrations",
    guestRange: "120+ GUESTS",
    price: "Starting at ₹3,25,000",
    image: "/images/packages/grand-celebration.jpg",
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
    ctaText: "Select Grand Celebrations",
    ctaHref: "/#plan-event",
    isPopular: false,
  },
  {
    id: "small-budget-wedding",
    name: "Small Budget Wedding",
    guestRange: "30 TO 80 GUESTS",
    price: "Starting at ₹85,000",
    image: "/images/packages/small-budget-wedding.jpg",
    description:
      "Tasteful intimate Indian wedding, roka, or engagement setup with beautiful economical decor and full coordination.",
    features: [
      "Traditional Floral Mandap / Roka Ceremony Backdrop",
      "Brass Urlis with Floating Florals & Ambient Diyas",
      "Candid Wedding Photography (Full Ceremony Coverage)",
      "Traditional Welcome Drinks & Refreshment Catering Setup",
      "1 Dedicated Wedding Day Coordinator on Site",
      "Digital Animated Invitation & RSVP Coordination",
      "Complete Setup & Post-Event Dismantling",
    ],
    ctaText: "Select Small Budget Wedding",
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
      name: "Balcony / Terrace",
      description:
        "Open-air ambient styling with warm fairy lighting, cozy floor cushions, and intimate terrace decor. (10 to 30 guests).",
      price: 35000,
      priceCurrency: "INR",
      url: "https://eventsika.in/packages#balcony-terrace",
      itemOffered: {
        "@type": "Service",
        name: "Balcony / Terrace Celebration Package",
        description:
          "Includes signature floral canopy, fairy light mesh, low diwan seating, bluetooth sound system, and on-site coordinator.",
        provider: {
          "@type": "Organization",
          name: "Eventsika",
          url: "https://eventsika.in",
        },
      },
    },
    {
      "@type": "Offer",
      name: "Driveway / Lawns",
      description:
        "Our most popular all-in-one celebration package with signature decor, catering, DJ, and full management. (50 to 120 guests).",
      price: 125000,
      priceCurrency: "INR",
      url: "https://eventsika.in/packages#driveway-lawns",
      itemOffered: {
        "@type": "Service",
        name: "Driveway / Lawns Celebration Package",
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
      name: "Living Rooms / Family Dinner",
      description:
        "Designed for cozy apartment living rooms, family dinners, and intimate milestone gatherings at home. (10 to 35 guests).",
      price: 45000,
      priceCurrency: "INR",
      url: "https://eventsika.in/packages#living-rooms-dinner",
      itemOffered: {
        "@type": "Service",
        name: "Living Rooms / Family Dinner Celebration Package",
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
      name: "Showrooms / Offices",
      description:
        "Sophisticated corporate celebrations, brand launches, or office milestone events with sleek modern decor. (25 to 100+ guests).",
      price: 65000,
      priceCurrency: "INR",
      url: "https://eventsika.in/packages#showrooms-offices",
      itemOffered: {
        "@type": "Service",
        name: "Showrooms / Offices Celebration Package",
        description:
          "Includes modern corporate stage & backdrop branding, artisanal high-tea catering, AV & lighting, photography, and floor management.",
        provider: {
          "@type": "Organization",
          name: "Eventsika",
          url: "https://eventsika.in",
        },
      },
    },
    {
      "@type": "Offer",
      name: "Grand Celebrations",
      description:
        "Luxury full-scale transformation for milestone anniversaries, grand housewarmings, and pre-wedding soirees. (120+ guests).",
      price: 325000,
      priceCurrency: "INR",
      url: "https://eventsika.in/packages#grand-celebrations",
      itemOffered: {
        "@type": "Service",
        name: "Grand Celebrations Package",
        description:
          "Includes custom architectural fabrication, live gourmet counter showcase, full cinematography team with drone, live fusion band & celebrity anchor, valet & guest concierge, and keepsake invitations.",
        provider: {
          "@type": "Organization",
          name: "Eventsika",
          url: "https://eventsika.in",
        },
      },
    },
    {
      "@type": "Offer",
      name: "Small Budget Wedding",
      description:
        "Tasteful intimate Indian wedding, roka, or engagement setup with beautiful economical decor and full coordination. (30 to 80 guests).",
      price: 85000,
      priceCurrency: "INR",
      url: "https://eventsika.in/packages#small-budget-wedding",
      itemOffered: {
        "@type": "Service",
        name: "Small Budget Wedding Package",
        description:
          "Includes traditional floral mandap/roka backdrop, brass urlis with floating florals, wedding photography, welcome drinks & catering coordination, and dedicated wedding day coordinator.",
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

                  {pkg.image && (
                    <div className={styles.imageWrapper}>
                      <Image
                        src={pkg.image}
                        alt={pkg.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className={styles.cardImage}
                      />
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
