import Image from "next/image";
import Link from "next/link";
import styles from "./ForVendors.module.css";

const BENEFITS = [
  {
    number: "01",
    title: "BE DISCOVERED",
    description:
      "Put your services in front of people planning meaningful celebrations.",
  },
  {
    number: "02",
    title: "WORK WITH GREAT EVENTS",
    description:
      "Be part of thoughtfully planned celebrations where your expertise can make a difference.",
  },
  {
    number: "03",
    title: "BUILD YOUR PRESENCE",
    description:
      "Showcase your work and make it easier for the right clients to discover you.",
  },
];

export default function ForVendors() {
  return (
    <section
      id="for-vendors"
      className={styles.section}
      aria-labelledby="for-vendors-heading"
    >
      <div className={styles.container}>
        <div className={styles.contentGrid}>
          {/* Left Column: Editorial Photograph */}
          <div className={styles.imageFrame}>
            <Image
              src="/images/vendor-network-final.png"
              alt="Professional event coordinator managing an elegant celebration setup"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className={styles.image}
            />
            <div className={styles.imageOverlay} />
          </div>

          {/* Right Column: Copy & Benefits */}
          <div className={styles.rightColumn}>
            <p className={styles.eyebrow}>FOR VENDORS</p>
            <h2 id="for-vendors-heading" className={styles.title}>
              Grow your business with Eventsika.
            </h2>
            <p className={styles.description}>
              Join a curated network of event professionals and connect your work
              with celebrations that need your expertise.
            </p>

            {/* Vertical Editorial List of 3 Benefits */}
            <ol className={styles.benefitsList}>
              {BENEFITS.map((benefit) => (
                <li key={benefit.number} className={styles.benefitItem}>
                  <span className={styles.benefitNumber}>{benefit.number}</span>
                  <div className={styles.benefitContent}>
                    <h3 className={styles.benefitTitle}>{benefit.title}</h3>
                    <p className={styles.benefitDescription}>
                      {benefit.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Action Buttons */}
            <div className={styles.actionGroup}>
              <Link href="#contact" className={styles.ctaButton}>
                Become a Vendor
              </Link>
              <a
                href="mailto:hello@eventsika.in"
                className={styles.secondaryLink}
              >
                Already a vendor? Get in touch.
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
