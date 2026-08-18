import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "Log In | Client & Partner Portal",
  description:
    "Log in to your Eventsika account to manage celebration plans, custom proposals, and vendor coordination.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return (
    <div className={styles.pageWrapper}>
      {/* Background Decorative Glows */}
      <div className={styles.glowTop} aria-hidden="true" />
      <div className={styles.glowBottom} aria-hidden="true" />

      {/* Top Return Bar */}
      <header className={styles.topBar}>
        <Link href="/" className={styles.backLink} aria-label="Return to Eventsika Homepage">
          <svg
            className={styles.backIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to Home</span>
        </Link>

        <a href="mailto:care@eventsika.in" className={styles.helpLink}>
          Need help?
        </a>
      </header>

      {/* Main Login Form Area */}
      <main id="main-content" className={styles.mainContainer}>
        <LoginForm />
      </main>

      {/* Minimal Footer */}
      <footer className={styles.pageFooter}>
        <p>© {new Date().getFullYear()} Eventsika. All rights reserved.</p>
        <p className={styles.footerNote}>
          Dedicated celebration planning, decor, catering, and event coordination across India.
        </p>
      </footer>
    </div>
  );
}
