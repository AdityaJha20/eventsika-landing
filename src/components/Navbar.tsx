"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./Navbar.module.css";

const NAV_LINKS = [
  { label: "Home", href: "#" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Events", href: "#events" },
  { label: "Services", href: "/services" },
  { label: "Packages", href: "#packages" },
  { label: "For Vendors", href: "#for-vendors" },
  { label: "Contact", href: "#contact" },
];

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Brand / Logo Area */}
        <Link href="/" className={styles.brand} onClick={closeMobileMenu}>
          <Image
            src="/images/eventsika-official-logo.png"
            alt="Eventsika - Celebrate Seamlessly"
            width={147}
            height={100}
            priority
            className={styles.brandLogo}
          />
        </Link>

        {/* Center Desktop Navigation */}
        <nav className={styles.nav} aria-label="Main Navigation">
          <ul className={styles.navList}>
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className={styles.navLink}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Right Desktop Actions */}
        <div className={styles.rightSection}>
          <a
            href="tel:+919876543210"
            className={styles.phoneLink}
            aria-label="Call +91 98765 43210"
          >
            <svg
              className={styles.phoneIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>+91 98765 43210</span>
          </a>

          <Link href="#login" className={styles.loginLink}>
            Log In
          </Link>

          <Link href="#plan-event" className={styles.primaryButton}>
            Plan Your Event
          </Link>
        </div>

        {/* Mobile Controls (Primary CTA + Hamburger) */}
        <div className={styles.mobileControls}>
          <Link
            href="#plan-event"
            className={styles.primaryButton}
            style={{ padding: "0.5rem 0.9rem", fontSize: "0.8rem" }}
          >
            Plan Event
          </Link>
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={toggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            aria-label={
              isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
            }
          >
            {isMobileMenuOpen ? (
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <div
        id="mobile-menu"
        className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.mobileMenuOpen : ""
          }`}
      >
        <nav aria-label="Mobile Navigation">
          <ul className={styles.mobileNavList}>
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className={styles.mobileNavLink}
                  onClick={closeMobileMenu}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.mobileDivider} />

        <div className={styles.mobileActions}>
          <a
            href="tel:+919876543210"
            className={styles.phoneLink}
            onClick={closeMobileMenu}
            aria-label="Call +91 98765 43210"
          >
            <svg
              className={styles.phoneIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>+91 98765 43210</span>
          </a>

          <Link
            href="#login"
            className={styles.loginLink}
            onClick={closeMobileMenu}
          >
            Log In
          </Link>
        </div>
      </div>
    </header>
  );
}
