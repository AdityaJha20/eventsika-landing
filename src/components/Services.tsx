"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Services.module.css";

const SERVICES = [
  {
    number: "01",
    title: "Decor & Styling",
    description:
      "Bespoke venue aesthetics, floral design, ambient lighting, and artful tablescapes tailored to your celebration.",
    image: "/images/services/decor-styling.webp",
    alt: "Bespoke event venue aesthetics, floral styling, and ambient lighting",
    href: "/services",
  },
  {
    number: "02",
    title: "Catering & Cuisine",
    description:
      "Curated multi-course menus, gourmet catering, and refined dining experiences crafted for your guests.",
    image: "/images/services/catering-cuisine.webp",
    alt: "Gourmet celebration dining and elegant food presentation",
    href: "/services",
  },
  {
    number: "03",
    title: "Rituals & Blessings",
    description:
      "Traditional ceremonies, sacred rituals, and cultural blessings orchestrated with reverence and grace.",
    image: "/images/services/rituals-blessings.webp",
    alt: "Traditional ceremonies, sacred rituals, and cultural blessings",
    href: "/services",
  },
  {
    number: "04",
    title: "Entertainment & Performers",
    description:
      "Live musicians, captivating artists, DJs, and cultural performers that bring energy and memorable flair.",
    image: "/images/services/entertainment-performers.webp",
    alt: "Live musicians, cultural performers, and celebration entertainment",
    href: "/services",
  },
  {
    number: "05",
    title: "Photography & Films",
    description:
      "Cinematic films, editorial photography, and candid visual storytelling to preserve every cherished memory.",
    image: "/images/services/photography-films.webp",
    alt: "Cinematic films, editorial photography, and celebration storytelling",
    href: "/services",
  },
  {
    number: "06",
    title: "Invitations & Favours",
    description:
      "Custom stationery, bespoke invitations, thoughtful guest gifts, and keepsake favours crafted with care.",
    image: "/images/services/invitations-favours.webp",
    alt: "Custom stationery, bespoke invitations, and keepsake gifts",
    href: "/services",
  },
];

export default function Services() {
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  const toggleCard = (number: string) => {
    setFlippedCards((prev) => ({
      ...prev,
      [number]: !prev[number],
    }));
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

        {/* 6 Interactive 3D Flip Service Cards */}
        <ul className={styles.grid}>
          {SERVICES.map((service) => {
            const isFlipped = Boolean(flippedCards[service.number]);
            return (
              <li key={service.number} className={styles.card}>
                <div
                  tabIndex={0}
                  role="button"
                  aria-expanded={isFlipped}
                  aria-label={`${service.title} service details. Press Enter, Space or tap to flip card.`}
                  className={`${styles.cardInner} ${
                    isFlipped ? styles.cardInnerFlipped : ""
                  }`}
                  onClick={() => toggleCard(service.number)}
                  onKeyDown={(e) => handleKeyDown(e, service.number)}
                >
                  {/* FRONT FACE: Editorial Photography */}
                  <div className={styles.cardFront}>
                    <Image
                      src={service.image}
                      alt={service.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className={styles.image}
                    />
                    <div className={styles.frontOverlay} />
                    <div className={styles.frontContent}>
                      <div className={styles.frontHeader}>
                        <span className={styles.numberFront}>
                          {service.number}
                        </span>
                        <span className={styles.flipHint}>Details</span>
                      </div>
                      <h3 className={styles.titleFront}>{service.title}</h3>
                    </div>
                  </div>

                  {/* BACK FACE: Detailed Information */}
                  <div className={styles.cardBack}>
                    <div className={styles.backMain}>
                      <div className={styles.backHeader}>
                        <span className={styles.numberBack}>
                          {service.number}
                        </span>
                      </div>
                      <h3 className={styles.titleBack}>{service.title}</h3>
                      <p className={styles.descriptionBack}>
                        {service.description}
                      </p>
                    </div>
                    <Link href={service.href} className={styles.exploreLink}>
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
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Section Bottom CTA */}
        <div className={styles.ctaContainer}>
          <Link href="/services" className={styles.ctaButton}>
            Explore All Services &amp; Pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
