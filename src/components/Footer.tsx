import Image from "next/image";
import Link from "next/link";
import styles from "./Footer.module.css";

const EXPLORE_LINKS = [
  { label: "Home", href: "#" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Events", href: "#events" },
  { label: "Packages", href: "/packages" },
];

const SERVICE_LINKS = [
  { label: "Venue & Decor", href: "/services" },
  { label: "Catering", href: "/services" },
  { label: "Photography & Films", href: "/services" },
  { label: "Entertainment", href: "/services" },
  { label: "Event Management", href: "/services" },
];

export default function Footer() {
  return (
    <footer id="contact" className={styles.footer} aria-label="Site Footer">
      <div className={styles.container}>
        {/* Main Grid */}
        <div className={styles.mainGrid}>
          {/* Brand Area */}
          <div className={styles.brandCol}>
            <Link
              href="/"
              className={styles.brandLink}
              aria-label="Eventsika Homepage"
            >
              <Image
                src="/images/eventsika-official-logo.png"
                alt="Eventsika - Celebrate Seamlessly"
                width={132}
                height={90}
                className={styles.brandLogo}
              />
            </Link>
            <p className={styles.brandDescription}>
              Thoughtfully planned celebrations, beautifully delivered.
            </p>
          </div>

          {/* Explore Column */}
          <nav aria-label="Explore Navigation">
            <h3 className={styles.colHeading}>Explore</h3>
            <ul className={styles.linkList}>
              {EXPLORE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Services Column */}
          <nav aria-label="Services Navigation">
            <h3 className={styles.colHeading}>Services</h3>
            <ul className={styles.linkList}>
              {SERVICE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact Column */}
          <div>
            <h3 className={styles.colHeading}>Get in touch</h3>
            <p className={styles.contactText}>Plan your celebration with us.</p>
            <a
              href="tel:+919876543210"
              className={styles.contactLink}
              aria-label="Call +91 98765 43210"
            >
              +91 98765 43210
            </a>
            <a
              href="mailto:hello@eventsika.in"
              className={styles.contactLink}
              aria-label="Email hello@eventsika.in"
            >
              hello@eventsika.in
            </a>
            <Link href="#plan-event" className={styles.ctaButton}>
              Plan Your Event
            </Link>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={styles.bottomBar}>
          <p className={styles.copyright}>
            © 2026 Eventsika. All rights reserved.
          </p>
          <div className={styles.legalLinks}>
            <Link href="#" className={styles.legalLink}>
              Privacy Policy
            </Link>
            <Link href="#" className={styles.legalLink}>
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
