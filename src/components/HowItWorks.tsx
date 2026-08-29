import Link from "next/link";
import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    number: "01",
    title: "DISCOVER",
    description:
      "Tell us about your celebration, your vision, and what matters most to you.",
  },
  {
    number: "02",
    title: "DESIGN",
    description:
      "Our team brings the details together, from the right services to the finishing touches.",
  },
  {
    number: "03",
    title: "CELEBRATE",
    description:
      "Everything is prepared and coordinated so you can simply enjoy the occasion.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className={styles.section}
      aria-labelledby="how-it-works-heading"
    >
      <div className={styles.container}>
        {/* Section Header */}
        <div className={styles.header}>
          <p className={styles.eyebrow}>HOW IT WORKS</p>
          <h2 id="how-it-works-heading" className={styles.title}>
            From your idea to an unforgettable celebration.
          </h2>
          <p className={styles.description}>
            We take care of the details, so you can focus on the moments that
            matter.
          </p>
        </div>

        {/* 3-Step Process Grid */}
        <ol className={styles.stepsGrid}>
          {STEPS.map((step) => (
            <li key={step.number} className={styles.stepItem}>
              <span className={styles.stepNumber}>{step.number}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
            </li>
          ))}
        </ol>

        {/* Section CTA */}
        <div className={styles.ctaContainer}>
          <Link href="/diwali-consultation" className={styles.ctaButton}>
            Start Planning
          </Link>
        </div>
      </div>
    </section>
  );
}
