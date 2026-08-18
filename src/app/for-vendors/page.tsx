import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import VendorApplicationForm from "@/components/VendorApplicationForm";
import Footer from "@/components/Footer";
import styles from "./for-vendors.module.css";

export const metadata: Metadata = {
  title: "For Vendors | Eventsika Partner Network",
  description:
    "Grow your event business with Eventsika. Join our curated network of event professionals and access confirmed bookings, guaranteed payouts, and on-site support.",
};

const VENDOR_BENEFITS = [
  {
    number: "01",
    title: "Guaranteed Payouts",
    description:
      "100% transparent milestone payouts directly to your bank account without chasing client receivables.",
  },
  {
    number: "02",
    title: "Pre-Qualified Leads",
    description:
      "Receive confirmed high-intent bookings matching your creative tier, calendar, and price points.",
  },
  {
    number: "03",
    title: "On-Site Support",
    description:
      "Our on-ground floor managers handle venue clearances, client questions, and timing coordination.",
  },
  {
    number: "04",
    title: "Zero Upfront Fees",
    description:
      "No annual subscription or listing fees. Join our curated network completely free.",
  },
];

const PARTNER_CATEGORIES = [
  {
    number: "01",
    title: "Floral & Set Decorators",
    tag: "Decor & Production",
    description:
      "Specialists in bespoke stage fabrication, entrance arches, mandaps, floral installations, and ambient celebration styling.",
  },
  {
    number: "02",
    title: "Caterers & Gourmet Chefs",
    tag: "Food & Beverage",
    description:
      "Culinary teams and boutique caterers crafting regional multi-course menus, live experiential chaat counters, and artisanal desserts.",
  },
  {
    number: "03",
    title: "Candid Photographers & Filmmakers",
    tag: "Photo & Cinema",
    description:
      "Visual storytellers capturing spontaneous emotions, traditional rituals, cinematic 4K highlight films, and drone cinematography.",
  },
  {
    number: "04",
    title: "Live Artists, DJs & Performers",
    tag: "Entertainment",
    description:
      "Musicians, classical performers, Sufi & acoustic fusion bands, party DJs, and bilingual emcees bringing vibrant celebration energy.",
  },
  {
    number: "05",
    title: "Vedic Priests & Pandits",
    tag: "Sacred Rituals",
    description:
      "Knowledgeable Acharyas and Pandits guiding sacred rituals, pujas, havans, and cultural ceremonies with authenticity and grace.",
  },
  {
    number: "06",
    title: "Stationery & Gifting Designers",
    tag: "Invites & Details",
    description:
      "Artisans creating custom luxury WhatsApp video invitations, letterpress paper goods, themed welcome hampers, and personalized favors.",
  },
];

export default function ForVendorsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        {/* For Vendors Hero Section */}
        <section
          className={styles.heroSection}
          aria-labelledby="vendors-hero-heading"
        >
          <div className={styles.heroContainer}>
            {/* Left: Copy & Actions */}
            <div className={styles.heroContent}>
              <p className={styles.eyebrow}>EVENTSIKA PARTNER NETWORK</p>
              <h1 id="vendors-hero-heading" className={styles.title}>
                Grow Your Event Business With Us
              </h1>
              <p className={styles.description}>
                Join India&apos;s curated network of event professionals.
                Connect with high-intent families, access confirmed bookings,
                and focus on your craft while we handle logistics and
                coordination.
              </p>

              <div className={styles.heroActions}>
                <Link href="#apply" className={styles.primaryCta}>
                  Become a Partner
                </Link>
                <a
                  href="mailto:care@eventsika.in"
                  className={styles.secondaryLink}
                >
                  Already a partner? Sign In →
                </a>
              </div>
            </div>

            {/* Right: Featured Editorial Photograph */}
            <div className={styles.heroImageFrame}>
              <Image
                src="/images/vendor-network-final.webp"
                alt="Professional event coordinator managing an elegant celebration setup"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className={styles.heroImage}
              />
              <div className={styles.heroImageOverlay} />
            </div>
          </div>
        </section>

        {/* 4 Core Vendor Benefits Section */}
        <section
          className={styles.benefitsSection}
          aria-labelledby="benefits-heading"
        >
          <div className={styles.benefitsContainer}>
            <div className={styles.benefitsHeader}>
              <p className={styles.eyebrow}>WHY PARTNER WITH US</p>
              <h2 id="benefits-heading" className={styles.benefitsTitle}>
                Built for exceptional event professionals
              </h2>
            </div>

            <ol className={styles.benefitsGrid}>
              {VENDOR_BENEFITS.map((benefit) => (
                <li key={benefit.number} className={styles.benefitCard}>
                  <span className={styles.benefitNumber}>{benefit.number}</span>
                  <h3 className={styles.benefitHeading}>{benefit.title}</h3>
                  <p className={styles.benefitDescription}>
                    {benefit.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Partner Categories Section */}
        <section
          id="categories"
          className={styles.categoriesSection}
          aria-labelledby="categories-heading"
        >
          <div className={styles.categoriesContainer}>
            <div className={styles.categoriesHeader}>
              <p className={styles.eyebrow}>PARTNER CATEGORIES</p>
              <h2 id="categories-heading" className={styles.categoriesTitle}>
                Who We Partner With
              </h2>
              <p className={styles.categoriesDescription}>
                We collaborate with passionate local artisans, established event
                vendors, and boutique studios across India.
              </p>
            </div>

            <ul className={styles.categoriesGrid}>
              {PARTNER_CATEGORIES.map((category) => (
                <li key={category.number} className={styles.categoryCard}>
                  <div className={styles.categoryCardHeader}>
                    <span className={styles.categoryNumber}>
                      {category.number}
                    </span>
                    <span className={styles.categoryTag}>{category.tag}</span>
                  </div>
                  <h3 className={styles.categoryTitle}>{category.title}</h3>
                  <p className={styles.categoryDescription}>
                    {category.description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Vendor Application Form Section */}
        <VendorApplicationForm />
      </main>
      <Footer />
    </>
  );
}
