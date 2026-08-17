"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./EventTypes.module.css";

const EVENT_TYPES = [
  {
    number: "01",
    title: "Birthday",
    description:
      "Make every birthday feel personal, joyful, and beautifully planned.",
    image: "/images/event-birthday.webp",
    alt: "Warm birthday celebration with sophisticated decor and ambient cake candles",
  },
  {
    number: "02",
    title: "Anniversary",
    description:
      "Celebrate your story with an intimate experience designed around you.",
    image: "/images/event-anniversary.webp",
    alt: "Intimate anniversary candlelit dining setup at home",
  },
  {
    number: "03",
    title: "Housewarming",
    description:
      "Welcome loved ones into your new space with warmth and thoughtful details.",
    image: "/images/event-housewarming.webp",
    alt: "Happy family standing and celebrating housewarming griha pravesh at home",
  },
  {
    number: "04",
    title: "Baby Shower",
    description:
      "Create a beautiful, memorable celebration for a very special new beginning.",
    image: "/images/event-baby-shower.webp",
    alt: "Delicate floral backdrop and ambient decor for baby shower godh bharai",
  },
  {
    number: "05",
    title: "Satsang & Puja",
    description:
      "Bring family and loved ones together for meaningful spiritual occasions.",
    image: "/images/event-satsang-puja.webp",
    alt: "Traditional Indian puja satsang gathering with marigold florals and oil lamps",
  },
  {
    number: "06",
    title: "Festive Party",
    description:
      "Celebrate the season with thoughtful décor, food, music, and atmosphere.",
    image: "/images/event-festive-party.webp",
    alt: "Warm Diwali festive celebration with fairy lights and traditional decor",
  },
  {
    number: "07",
    title: "Terrace Party",
    description:
      "Turn an open-air setting into a relaxed and unforgettable celebration.",
    image: "/images/event-terrace-party.webp",
    alt: "Open-air evening terrace celebration with warm fairy lighting",
  },
  {
    number: "08",
    title: "Family Dinner",
    description:
      "Create an intimate dining experience where good food and great company come together.",
    image: "/images/event-family-dinner.webp",
    alt: "Intimate family dining setup with elegant food presentation",
  },
];

export default function EventTypes() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeEvent = EVENT_TYPES[activeIndex];

  return (
    <section
      id="events"
      className={styles.section}
      aria-labelledby="events-heading"
    >
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <p className={styles.eyebrow}>CELEBRATIONS FOR EVERY MOMENT</p>
          <h2 id="events-heading" className={styles.title}>
            Plan celebrations for every moment.
          </h2>
          <p className={styles.description}>
            From intimate family gatherings to joyful milestones, we help you
            create an occasion worth remembering.
          </p>
        </div>

        {/* Editorial 2-Column Composition */}
        <div className={styles.contentGrid}>
          {/* Left Column: Featured Event Image Display */}
          <div className={styles.imageFrame}>
            {EVENT_TYPES.map((event, index) => {
              const isActive = index === activeIndex;
              return (
                <Image
                  key={event.number}
                  src={event.image}
                  alt={event.alt}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className={`${styles.featuredImage} ${
                    isActive ? styles.featuredImageActive : ""
                  }`}
                />
              );
            })}
            <div className={styles.imageOverlay} />
            <div className={styles.imageCaption}>
              <span className={styles.captionBadge}>
                {activeEvent.number} — CELEBRATION
              </span>
              <h3 className={styles.captionTitle}>{activeEvent.title}</h3>
            </div>
          </div>

          {/* Right Column: Interactive Event Items List */}
          <ul className={styles.eventList} role="tablist">
            {EVENT_TYPES.map((event, index) => {
              const isActive = index === activeIndex;
              return (
                <li key={event.number}>
                  <button
                    type="button"
                    role="tab"
                    id={`tab-${event.number}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${event.number}`}
                    className={`${styles.eventItem} ${
                      isActive ? styles.eventItemActive : ""
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => setActiveIndex(index)}
                  >
                    <span className={styles.number}>{event.number}</span>
                    <div className={styles.itemContent}>
                      <span className={styles.itemTitle}>{event.title}</span>
                      <p
                        id={`panel-${event.number}`}
                        className={styles.itemDescription}
                      >
                        {event.description}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
