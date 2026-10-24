import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PackageCustomizer from "@/components/PackageCustomizer";
import PackageComparison from "@/components/PackageComparison";
import Footer from "@/components/Footer";
import {
  CUSTOM_QUOTE_LABEL,
  PACKAGES_CONFIG,
  formatPerPersonRate,
} from "@/lib/packages-config";
import {
  buildPackagesOfferCatalogJsonLd,
  serializeJsonLd,
} from "@/lib/packages-structured-data";
import styles from "./packages.module.css";

const LOWEST_PACKAGE_RATE = Math.min(
  ...PACKAGES_CONFIG.map((pkg) => pkg.pricePerPerson)
);

export const metadata: Metadata = {
  title: "Packages | Decor Packages Priced Per Guest",
  description: `Essential, Premium and Luxury decor packages from ${formatPerPersonRate(LOWEST_PACKAGE_RATE)}. Add optional per-guest services such as food, floral styling and photography, and see an indicative estimate instantly.`,
  alternates: {
    canonical: "/packages",
  },
};

interface CelebrationSetting {
  id: string;
  name: string;
  guestRange: string;
  description: string;
  ideas: string[];
  image?: string;
}

/**
 * Venue and format inspiration. These settings have no approved fixed price,
 * so they are always quoted individually.
 */
const CELEBRATION_SETTINGS: CelebrationSetting[] = [
  {
    id: "balcony-terrace",
    name: "Balcony / Terrace",
    guestRange: "10 TO 30 GUESTS",
    image: "/images/packages/balcony-terrace.webp",
    description:
      "Open-air ambient styling with warm fairy lighting, cozy floor cushions, and intimate terrace decor.",
    ideas: [
      "Floral Canopy & Fairy Light Mesh",
      "Low Diwan Seating & Floor Cushions Setup",
      "Bluetooth Sound System & Playlist",
      "Ambient Brass Lanterns & Marigold Accents",
      "On-Site Event Coordinator",
      "Digital WhatsApp Invitation Design",
      "Setup & Post-Event Dismantling",
    ],
  },
  {
    id: "driveway-lawns",
    name: "Driveway / Lawns",
    guestRange: "50 TO 120 GUESTS",
    image: "/images/packages/driveway-lawns.webp",
    description:
      "Spacious driveway and lawn celebrations with room for staging, dining, and dancing under the open sky.",
    ideas: [
      "Entrance Toran + Themed Floral & Fabric Stage",
      "Multi-Course Buffet Catering",
      "Live Chaat / Mocktail Corner with Uniformed Staff",
      "Candid Photography + Highlight Video",
      "DJ, Party Sound & Lighting Rig",
      "Floor Manager & On-Ground Operations Staff",
    ],
  },
  {
    id: "living-rooms-dinner",
    name: "Living Rooms / Family Dinner",
    guestRange: "10 TO 35 GUESTS",
    image: "/images/packages/living-room-dinner.webp",
    description:
      "Designed for cozy apartment living rooms, family dinners, and intimate milestone gatherings at home.",
    ideas: [
      "Floral Backdrop or Mandap Styling",
      "Ambient Fairy Lights & Dining Table Centerpieces",
      "Candid Photography Coverage",
      "Bluetooth Sound System & Playlist",
      "On-Site Event Coordinator",
      "Digital WhatsApp Invitation Design",
      "Setup & Post-Event Dismantling",
    ],
  },
  {
    id: "showrooms-offices",
    name: "Showrooms / Offices",
    guestRange: "25 TO 100+ GUESTS",
    image: "/images/packages/showroom-office.webp",
    description:
      "Sophisticated corporate celebrations, brand launches, or office milestone events with sleek modern decor.",
    ideas: [
      "Modern Corporate Stage & Backdrop Branding",
      "High-Tea & Finger Food Catering",
      "AV, Microphones & Ambient Lighting",
      "Corporate Event Photography & Highlight Reel",
      "On-Site Floor Management Team",
      "Welcome Desk & Registration Setup Assistance",
    ],
  },
  {
    id: "grand-celebrations",
    name: "Grand Celebrations",
    guestRange: "120+ GUESTS",
    image: "/images/packages/grand-celebration.webp",
    description:
      "Full-scale transformation for milestone anniversaries, grand housewarmings, and pre-wedding soirees.",
    ideas: [
      "Custom Fabrication, Flower Chandeliers & Draped Canopies",
      "Live Gourmet Counters (Indian, Continental, Desserts)",
      "Cinematography Team with Drone & Candid Duo",
      "Live Sufi / Acoustic Fusion Band & Anchor",
      "Guest Concierge & Valet Management",
      "Boxed Keepsake Invites + Favors",
      "Animated Video WhatsApp Invitation & RSVP Microsite",
    ],
  },
  {
    id: "small-budget-wedding",
    name: "Small Budget Wedding",
    guestRange: "30 TO 80 GUESTS",
    image: "/images/packages/small-budget-wedding.webp",
    description:
      "Tasteful intimate Indian wedding, roka, or engagement setup with beautiful decor and thoughtful coordination.",
    ideas: [
      "Traditional Floral Mandap / Roka Ceremony Backdrop",
      "Brass Urlis with Floating Florals & Ambient Diyas",
      "Candid Wedding Photography",
      "Welcome Drinks & Refreshment Catering Setup",
      "Wedding Day Coordinator on Site",
      "Digital Animated Invitation & RSVP Coordination",
      "Setup & Post-Event Dismantling",
    ],
  },
];

const packagesJsonLd = buildPackagesOfferCatalogJsonLd();

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
          __html: serializeJsonLd(packagesJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(breadcrumbJsonLd),
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
              Decor Packages, Priced Per Guest
            </h1>
            <p className={styles.description}>
              Choose Essential, Premium or Luxury decor from{" "}
              {formatPerPersonRate(LOWEST_PACKAGE_RATE)}. Each package includes
              decor only; add the optional services you need, each charged per
              guest at your package&apos;s rate.
            </p>
          </div>
        </section>

        {/* Live Package Customizer — primary pricing experience */}
        <PackageCustomizer />

        {/* Detailed Inclusions Comparison */}
        <PackageComparison />

        {/* Celebration Settings (custom quote) */}
        <section
          className={styles.tiersSection}
          aria-labelledby="packages-settings-heading"
        >
          <div className={styles.tiersContainer}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>CELEBRATION SETTINGS</p>
              <h2 id="packages-settings-heading" className={styles.sectionTitle}>
                Settings We Style
              </h2>
              <p className={styles.description}>
                Looking for a specific setting? These formats are quoted
                individually. Share your details and we will prepare a custom
                quote, or estimate any setting with a decor package above.
              </p>
            </div>

            <ul className={styles.grid}>
              {CELEBRATION_SETTINGS.map((setting) => (
                <li key={setting.id} id={setting.id} className={styles.card}>
                  {setting.image && (
                    <div className={styles.imageWrapper}>
                      <Image
                        src={setting.image}
                        alt={setting.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className={styles.cardImage}
                      />
                    </div>
                  )}

                  <div className={styles.cardHeader}>
                    <span className={styles.guestRange}>{setting.guestRange}</span>
                    <h3 className={styles.packageName}>{setting.name}</h3>
                    <div className={styles.priceTag}>{CUSTOM_QUOTE_LABEL}</div>
                    <p className={styles.packageDescription}>
                      {setting.description}
                    </p>
                  </div>

                  <div className={styles.divider} />

                  <div className={styles.featuresSection}>
                    <p className={styles.featuresTitle}>
                      Ideas to Include in Your Quote:
                    </p>
                    <ul className={styles.featureList}>
                      {setting.ideas.map((idea) => (
                        <li key={idea} className={styles.featureItem}>
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
                          <span>{idea}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={styles.cardFooter}>
                    <Link href="/#plan-event" className={styles.ctaButton}>
                      {CUSTOM_QUOTE_LABEL}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
