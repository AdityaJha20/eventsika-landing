import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ServiceEstimator from "@/components/ServiceEstimator";
import ServicesFAQ from "@/components/ServicesFAQ";
import Footer from "@/components/Footer";
import styles from "./services.module.css";

export const metadata: Metadata = {
  title: "Services | Bespoke Celebration Services",
  description:
    "From intimate home gatherings to grand festive galas, explore our full spectrum of curated services crafted to make your special moments effortless and memorable.",
  alternates: {
    canonical: "/services",
  },
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
      name: "Services",
      item: "https://eventsika.in/services",
    },
  ],
};

const SERVICES_DATA = [
  {
    number: "01 // SERVICE",
    title: "Decor & Styling",
    price: "Starting from ₹25,000",
    description:
      "From home living rooms and terrace settings to lawns and banquet halls, our team shapes the visual atmosphere of your celebration with fresh floral design, ambient lighting, tailored backdrops, and coordinated seating.",
    features: [
      "Mandaps, Stage Backdrops & Thematic Settings",
      "Fresh Marigold, Jasmine & Seasonal Floral Styling",
      "Ambient Fairy Lights & Warm Lantern Accents",
      "Diwan Seating & Coordinated Lounge Arrangements",
      "Welcome Entrances & Photo Corner Details",
      "On-Site Setup & Post-Event Dismantling",
    ],
    image: "/images/service-decor-styling.png",
    alt: "Bespoke event venue decoration with floral artistry and ambient lighting",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "02 // SERVICE",
    title: "Catering & Cuisine",
    price: "Starting from ₹650 / plate",
    description:
      "Thoughtfully planned celebration dining for family gatherings and festive occasions. We coordinate authentic regional dishes, live cooking counters, and traditional dessert spreads served with attentive hospitality and high hygiene standards.",
    features: [
      "Multi-Course Menus Across Popular Regional Cuisines",
      "Dedicated Pure Vegetarian & Satvik Preparation Options",
      "Live Chaat, Tandoor & Fresh Snack Counters",
      "Traditional Mithai & Contemporary Dessert Selections",
      "Uniformed Hospitality Staff & Dining Service Lead",
      "Coordinated Tableware, Brass Service & Display Setups",
    ],
    image: "/images/service-catering-cuisine.png",
    alt: "Gourmet celebration catering with live food counters and authentic cuisine",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "03 // SERVICE",
    title: "Rituals & Blessings",
    price: "Starting from ₹12,000 / event",
    description:
      "Structured coordination for traditional Indian ceremonies, family pujas, and sacred milestones. We assist with experienced pandits, ritual planning, authentic samagri, and ceremonial arrangements so rituals flow smoothly alongside your wider celebration.",
    features: [
      "Coordination with Experienced Pandits & Ceremony Priests",
      "Muhurat & Ritual Flow Schedule Management",
      "Complete Pooja Samagri & Ceremonial Essentials",
      "Traditional Havan & Sacred Ceremony Seating Setup",
      "Ceremonial Chants, Shehnai & Traditional Music Support",
      "Guest Flow Management Around Sacred Rites",
    ],
    image: "/images/service-rituals-blessings.png",
    alt: "Cinematic event photography and candid celebration films",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "04 // SERVICE",
    title: "Entertainment & Performers",
    price: "Starting from ₹15,000",
    description:
      "Curated music and entertainment designed to match the mood of each celebration segment. From classical morning recitals and folk troupes to energetic Sangeet DJs, live singers, and interactive hosts, we bring the right artists to your event.",
    features: [
      "Sangeet & Party DJs with Balanced Sound Systems",
      "Live Acoustic, Folk & Sufi Vocal Artists",
      "Traditional Shehnai, Dhol & Percussion Troupes",
      "Professional Event Emcees & Celebration Hosts",
      "Family Game Coordination & Children's Activity Hosts",
      "Ambient Stage Lighting & Audio Setup Support",
    ],
    image: "/images/service-entertainment-performers.png",
    alt: "Live celebration music, acoustic artists, and sangeet DJ entertainment",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "05 // SERVICE",
    title: "Photography & Films",
    price: "Starting from ₹18,000 / day",
    description:
      "Thoughtful visual documentation capturing spontaneous family moments, important rituals, and genuine emotion. Our team provides candid photography, family portraits, and highlight films that preserve the spirit of your day without feeling intrusive.",
    features: [
      "Candid & Traditional Celebration Photography Coverage",
      "Cinematic Event Highlight Films & Teasers",
      "Dedicated Family Portraits & Stage Group Photography",
      "High-Resolution Color-Corrected Digital Image Gallery",
      "Short Video Edits Optimized for Easy Sharing",
      "Handcrafted Photo Album Options for Family Keepsakes",
    ],
    image: "/images/service-photography-films.png",
    alt: "Dedicated on-site event coordinator managing seamless celebration execution",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
  {
    number: "06 // SERVICE",
    title: "Invitations & Favours",
    price: "Starting from ₹5,000",
    description:
      "Set the tone before your celebration begins with cohesive stationery, guest communications, and gifting. We coordinate digital invitations, RSVP microsites, physical cards, and curated gift hampers tailored to your family's occasion.",
    features: [
      "Animated Video Invitations for WhatsApp Sharing",
      "Interactive Digital RSVP & Event Itinerary Pages",
      "Printed Invitation Cards & Traditional Formal Stationery",
      "Curated Welcome Hampers & Return Favours for Guests",
      "Personalized Welcome Notes & Celebration Tags",
      "Coordinated Welcome Easels & Event Space Signage",
    ],
    image: "/images/service-invitations-details.webp",
    alt: "Luxury custom stationery, gold foil invitations, and curated celebration gifting",
    ctaText: "Book This Service",
    ctaHref: "/#plan-event",
  },
];

export default function ServicesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
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
                  className={`${styles.serviceItem} ${isReverse ? styles.serviceItemReverse : ""
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
            <Link href="/diwali-consultation" className={styles.consultationCta}>
              Book a Free Consultation
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
