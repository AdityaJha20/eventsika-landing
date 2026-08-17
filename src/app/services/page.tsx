import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ServiceEstimator from "@/components/ServiceEstimator";
import ServicesFAQ from "@/components/ServicesFAQ";
import Footer from "@/components/Footer";
import styles from "./services.module.css";

export const metadata: Metadata = {
  title: "Services | Eventsika - Bespoke Celebration Services",
  description:
    "From intimate home gatherings to grand festive galas, explore our full spectrum of curated services crafted to make your special moments effortless and memorable.",
};

const SERVICES_DATA = [
  {
    number: "01 // SERVICE",
    title: "Venue Sourcing & Thematic Decor",
    price: "Starting from ₹25,000",
    description:
      "From home living rooms and rooftop terraces to boutique lawns and banquet spaces, our design team transforms every square foot with bespoke floral artistry, warm ambient lighting, drape installations, and curated props.",
    features: [
      "Custom Mandaps & Stage Backdrops",
      "Fresh Marigold & Exotic Floral Cascades",
      "Fairy Light Ceilings & Edison Bulb Canopy",
      "Vintage & Contemporary Diwan Seating",
      "Entrance Toran & Photo Booth Corners",
      "Complete Setup & Post-Event Dismantling",
    ],
    image: "/images/service-venue-decor.png",
    alt: "Bespoke event venue decoration with floral artistry and ambient lighting",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "02 // SERVICE",
    title: "Gourmet Catering & Live Counters",
    price: "Starting from ₹650 / plate",
    description:
      "Crafted specifically for Indian family celebrations. We provide regional authentic delicacies, signature live chaat corners, mocktail stations, and silver/copper service setups delivered with hygienic perfection.",
    features: [
      "Traditional Pure Veg & Satvik Options",
      "Live Chaat, Dosa & Tandoori Counters",
      "Authentic Regional Delicacies (Bengali, Marwari, Punjabi, South Indian)",
      "Artisanal Mithai & Fusion Dessert Bars",
      "Uniformed Hospitality Staff & Bartenders",
      "Premium Chinaware, Brassware & Glassware",
    ],
    image: "/images/service-catering.png",
    alt: "Gourmet celebration catering with live food counters and authentic cuisine",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "03 // SERVICE",
    title: "Photography & Cinematic Films",
    price: "Starting from ₹18,000 / day",
    description:
      "Our cinematographers and candid photographers specialize in capturing emotional family rituals, spontaneous laughter, and heartwarming interactions without intrusive setups.",
    features: [
      "Candid & Traditional Photographers",
      "Cinematic 4K Highlights & Teaser Reels",
      "Instagram Same-Day Reel Delivery",
      "High Resolution Edited Digital Gallery",
      "Handcrafted Hardcover Photo Albums",
      "Drone Coverage for Outdoor & Terrace Venues",
    ],
    image: "/images/service-photography.png",
    alt: "Cinematic event photography and candid celebration films",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "04 // SERVICE",
    title: "Music, Sangeet & Live Entertainment",
    price: "Starting from ₹15,000",
    description:
      "Whether you want soulful Sufi melodies for an anniversary, energetic Sangeet DJs with dhol players, classical Shehnai for a puja, or magicians for kids birthdays, we curate the finest artists.",
    features: [
      "Bespoke Sangeet DJs with Premium Sound Systems",
      "Live Acoustic & Sufi Vocalists",
      "Traditional Shehnai, Sitar & Dhol Troupes",
      "Interactive Emcees & Game Hosts",
      "Kids Magicians, Puppet Shows & Craft Stations",
      "Intelligent Mood Lighting & Fog Effects",
    ],
    image: "/images/service-entertainment.png",
    alt: "Live celebration music, acoustic artists, and sangeet DJ entertainment",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "05 // SERVICE",
    title: "End-to-End On-Site Event Management",
    price: "Starting from ₹12,000 / event",
    description:
      "No running around or coordinating delivery logistics on your special day. A dedicated Eventsika manager stays on ground from dawn to dusk handling vendor timelines, hospitality, and troubleshooting.",
    features: [
      "Dedicated Floor Manager & Assistant Execution",
      "Minute-by-Minute Event Timeline",
      "Vendor Arrival & Quality Audits",
      "Guest Concierge & Welcome Hospitality",
      "Gift & Favor Distribution Management",
      "Emergency Kit & Troubleshooting On Standby",
    ],
    image: "/images/service-event-management.png",
    alt: "Dedicated on-site event coordinator managing seamless celebration execution",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "06 // SERVICE",
    title: "Custom Invitations, Gifting & Details",
    price: "Starting from ₹5,000",
    description:
      "Set the tone before the celebration begins. We craft animated digital video invitations, bespoke RSVP websites, luxury welcome hampers, and personalized return gifts customized to your theme.",
    features: [
      "Animated WhatsApp Video Invitations",
      "Custom Interactive RSVP Microsites",
      "Gold Foil & Letterpress Physical Cards",
      "Curated Return Gift Hampers & Mithai Boxes",
      "Personalized Luggage Tags & Welcome Cards",
      "Themed Signage & Seating Charts",
    ],
    image: "/images/service-invitations-details.png",
    alt: "Luxury custom stationery, gold foil invitations, and curated celebration gifting",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
];

export default function ServicesPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        {/* Services Page Hero */}
        <section
          className={styles.heroSection}
          aria-labelledby="services-hero-heading"
        >
          <div className={styles.container}>
            <p className={styles.eyebrow}>OUR OFFERINGS</p>
            <h1 id="services-hero-heading" className={styles.title}>
              Bespoke Celebration Services
            </h1>
            <p className={styles.description}>
              From intimate home gatherings to grand festive galas, explore our
              full spectrum of curated services crafted to make your special
              moments effortless and memorable.
            </p>
          </div>
        </section>

        {/* First 2 Detailed Service Sections */}
        <section
          className={styles.servicesListSection}
          aria-label="Detailed Celebration Services"
        >
          <div className={styles.servicesContainer}>
            {SERVICES_DATA.map((service, index) => {
              const isReverse = index % 2 === 1;
              return (
                <article
                  key={service.title}
                  className={`${styles.serviceItem} ${
                    isReverse ? styles.serviceItemReverse : ""
                  }`}
                  aria-labelledby={`service-heading-${index + 1}`}
                >
                  {/* Service Photography */}
                  <div className={styles.imageFrame}>
                    <Image
                      src={service.image}
                      alt={service.alt}
                      fill
                      priority={index === 0}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className={styles.serviceImage}
                    />
                  </div>

                  {/* Service Editorial Content */}
                  <div className={styles.contentCol}>
                    <div className={styles.metaRow}>
                      <span className={styles.serviceLabel}>
                        {service.number}
                      </span>
                      <span className={styles.servicePrice}>
                        {service.price}
                      </span>
                    </div>

                    <h2
                      id={`service-heading-${index + 1}`}
                      className={styles.serviceTitle}
                    >
                      {service.title}
                    </h2>

                    <p className={styles.serviceDescription}>
                      {service.description}
                    </p>

                    <div className={styles.divider} />

                    <h3 className={styles.featuresHeading}>
                      What&apos;s Included
                    </h3>

                    <ul className={styles.featuresList}>
                      {service.features.map((feature) => (
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

                    <div className={styles.actionRow}>
                      <Link
                        href={service.ctaHref}
                        className={styles.bookButton}
                      >
                        {service.ctaText}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Instant Service Cost Estimator */}
        <ServiceEstimator />

        {/* Frequently Asked Questions */}
        <ServicesFAQ />

        {/* Final Consultation CTA Section */}
        <section
          className={styles.consultationSection}
          aria-labelledby="consultation-heading"
        >
          <div className={styles.consultationCard}>
            <p className={styles.consultationEyebrow}>
              READY TO DESIGN YOUR DREAM EVENT?
            </p>
            <h2 id="consultation-heading" className={styles.consultationTitle}>
              Ready to Design Your Dream Event?
            </h2>
            <p className={styles.consultationDescription}>
              Speak with our celebration designer today. We will craft a
              customized moodboard, curated menu, and timeline tailored to your
              family&apos;s taste.
            </p>
            <Link href="/#plan-event" className={styles.consultationCta}>
              Book a Free Consultation
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
