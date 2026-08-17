"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Services.module.css";

const SERVICES = [
  {
    number: "01",
    title: "VENUE & DECOR",
    description:
      "Beautiful spaces, considered styling, and details that make the setting feel unmistakably yours.",
    image: "/images/service-venue-decor.png",
    alt: "Elegant event venue with floral arrangements and ambient candlelight",
    href: "#services",
  },
  {
    number: "02",
    title: "CATERING",
    description:
      "Thoughtful menus and seamless service designed around your occasion and your guests.",
    image: "/images/service-catering.png",
    alt: "Gourmet celebration dining and elegant food presentation",
    href: "#services",
  },
  {
    number: "03",
    title: "PHOTOGRAPHY & FILMS",
    description:
      "Capture the atmosphere, emotions, and moments you'll want to remember long after the celebration.",
    image: "/images/service-photography.png",
    alt: "Professional event photographer capturing candid celebration moments",
    href: "#services",
  },
  {
    number: "04",
    title: "ENTERTAINMENT",
    description:
      "Music, performances, and experiences that give your celebration its own energy and character.",
    image: "/images/service-entertainment.png",
    alt: "Live acoustic musical performance at an elegant celebration",
    href: "#services",
  },
  {
    number: "05",
    title: "EVENT MANAGEMENT",
    description:
      "Careful coordination from planning through execution, so every detail comes together smoothly.",
    image: "/images/service-event-management.png",
    alt: "Professional event coordinator managing venue setup details",
    href: "#services",
  },
  {
    number: "06",
    title: "INVITATIONS & DETAILS",
    description:
      "Beautiful stationery, guest communication, and finishing touches that complete the experience.",
    image: "/images/service-invitations-details.png",
    alt: "Luxury event stationery, wedding invitations, and gold foil details",
    href: "#services",
  },
];

export default function Services() {
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const toggleCard = (number: string) => {
    setActiveCard((prev) => (prev === number ? null : number));
  };

  const handleKeyDown = (e: React.KeyboardEvent, number: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCard(number);
    }
  };

  return (
    <section
      id="services"
      className={styles.section}
      aria-labelledby="services-heading"
    >
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <p className={styles.eyebrow}>WHAT WE OFFER</p>
          <h2 id="services-heading" className={styles.title}>
            Everything you need for a beautifully planned celebration.
          </h2>
          <p className={styles.description}>
            From the first idea to the final detail, we bring the right people,
            services, and finishing touches together.
          </p>
        </div>

        {/* 6 Editorial Service Cards with Overlay Interaction */}
        <ul className={styles.grid}>
          {SERVICES.map((service) => {
            const isRevealed = activeCard === service.number;
            return (
              <li key={service.number}>
                <div
                  tabIndex={0}
                  role="button"
                  aria-expanded={isRevealed}
                  aria-label={`${service.title} service details. Press Enter, Space or tap to view details.`}
                  className={`${styles.card} ${
                    isRevealed ? styles.cardRevealed : ""
                  }`}
                  onClick={() => toggleCard(service.number)}
                  onKeyDown={(e) => handleKeyDown(e, service.number)}
                >
                  {/* Background Photography */}
                  <Image
                    src={service.image}
                    alt={service.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className={styles.image}
                  />
                  <div className={styles.defaultOverlay} />

                  {/* Default Front Content */}
                  <div className={styles.frontContent}>
                    <span className={styles.numberFront}>{service.number}</span>
                    <h3 className={styles.titleFront}>{service.title}</h3>
                  </div>

                  {/* Revealed Editorial Detail Overlay */}
                  <div className={styles.detailOverlay}>
                    <div className={styles.detailContent}>
                      <div className={styles.detailHeader}>
                        <span className={styles.numberDetail}>
                          {service.number}
                        </span>
                      </div>
                      <h3 className={styles.titleDetail}>{service.title}</h3>
                      <p className={styles.descriptionDetail}>
                        {service.description}
                      </p>
                    </div>
                    <div className={styles.exploreLink}>
                      <span>Explore service</span>
                      <svg
                        className={styles.arrowIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Section Bottom CTA */}
        <div className={styles.ctaContainer}>
          <Link href="#services" className={styles.ctaButton}>
            Explore Our Services
          </Link>
        </div>
      </div>
    </section>
  );
}
