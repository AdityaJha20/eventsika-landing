import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import HowItWorks from "@/components/HowItWorks";
import PackageCustomizer from "@/components/PackageCustomizer";
import PackageComparison from "@/components/PackageComparison";
import PackageShowcase from "@/components/PackageShowcase";
import Footer from "@/components/Footer";
import {
  BASE_PACKAGE_INCLUSION,
  CUSTOM_QUOTE_LABEL,
  DEFAULT_GUEST_COUNT,
  DEFAULT_PACKAGE_ID,
  ESTIMATE_DISCLAIMER,
  OPTIONAL_SERVICES_CONFIG,
  PACKAGES_CONFIG,
  calculatePackageEstimate,
  formatCurrency,
  formatPerPersonRate,
  getPackageTier,
} from "@/lib/packages-config";
import { buildPackagesOfferCatalogJsonLd } from "@/lib/packages-structured-data";
import { breadcrumbJsonLd, pageMetadata, serializeJsonLd } from "@/lib/seo";
import styles from "./packages.module.css";

const LOWEST_PACKAGE_RATE = Math.min(
  ...PACKAGES_CONFIG.map((pkg) => pkg.pricePerPerson)
);

export const metadata: Metadata = pageMetadata({
  title: "Packages | Decor Packages Priced Per Guest",
  description: `Essential, Premium and Luxury decor packages from ${formatPerPersonRate(LOWEST_PACKAGE_RATE)}. Add optional per-guest services such as food, floral styling and photography, and see an indicative estimate instantly.`,
  path: "/packages",
});

const EXAMPLE_ESTIMATE = calculatePackageEstimate(DEFAULT_GUEST_COUNT, DEFAULT_PACKAGE_ID);

/** Answer-first pricing facts, generated from the pricing catalog so they never drift. */
const PRICING_ANSWERS: Array<{ question: string; answer: React.ReactNode }> = [
  {
    question: "What does each package include?",
    answer: `${BASE_PACKAGE_INCLUSION}. ${PACKAGES_CONFIG.map((pkg) => `${pkg.name} is ${formatPerPersonRate(pkg.pricePerPerson)}`).join(", ")}. The exact decor scope for your celebration is confirmed in your quote.`,
  },
  {
    question: "Are food, photography and other services included?",
    answer: `No. ${OPTIONAL_SERVICES_CONFIG.map((service) => service.name).join(", ")} are optional. Each is charged per guest only when you select it, at the rate for your chosen package.`,
  },
  {
    question: "How is my estimate calculated?",
    answer: `Your per-guest total is the decor rate plus the rates of any optional services you select, multiplied by your guest count. For example, ${getPackageTier(DEFAULT_PACKAGE_ID).name} decor for ${EXAMPLE_ESTIMATE.guestCount} guests is ${formatPerPersonRate(EXAMPLE_ESTIMATE.decorRatePerPerson)} × ${EXAMPLE_ESTIMATE.guestCount} = ${formatCurrency(EXAMPLE_ESTIMATE.total)}.`,
  },
  {
    question: "Why can the final price differ from the estimate?",
    answer: ESTIMATE_DISCLAIMER,
  },
  {
    question: "How do I get a confirmed quote?",
    answer: (
      <>
        Build your estimate in the <Link href="#customizer">Live Customizer</Link>,
        open your indicative estimate, then share your celebration details
        through the <Link href="/#plan-event">enquiry form</Link>. Settings below
        without a fixed price, and services such as rituals, entertainment and
        invitations on the <Link href="/services">services page</Link>, are
        quoted individually.
      </>
    ),
  },
];

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
          __html: serializeJsonLd(breadcrumbJsonLd("Packages", "/packages")),
        }}
      />
      <Navbar />
      <main id="main-content">
        {/* Keeps one page-level heading for screen readers and search; not shown visually. */}
        <h1 className={styles.srOnly}>Decor Packages, Priced Per Guest</h1>
        <HowItWorks />

        {/* Editorial package showcase */}
        <PackageShowcase />

        {/* Live Package Customizer — primary pricing experience */}
        <PackageCustomizer />

        {/* Detailed Inclusions Comparison */}
        <PackageComparison />

        <section className={styles.answersSection} aria-labelledby="pricing-answers-heading">
          <div className={styles.answersContainer}>
            <div className={styles.sectionHeader}>
              <p className={styles.eyebrow}>PRICING, ANSWERED</p>
              <h2 id="pricing-answers-heading" className={styles.sectionTitle}>
                How Package Pricing Works
              </h2>
            </div>
            <dl className={styles.answersList}>
              {PRICING_ANSWERS.map((item) => (
                <div key={item.question} className={styles.answerItem}>
                  <dt className={styles.answerQuestion}>{item.question}</dt>
                  <dd className={styles.answerText}>{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

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
