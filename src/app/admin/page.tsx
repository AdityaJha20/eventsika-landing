import type { Metadata } from "next";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export default function AdminDashboardPage() {
  return (
    <div className={styles.dashboardPlaceholder}>
      <header className={styles.pageHeader}>
        <h1 className={styles.title}>Admin Dashboard</h1>
        <p className={styles.subtitle}>
          Eventsika administration and operations portal.
        </p>
      </header>

      <section className={styles.statusCard} aria-labelledby="status-card-heading">
        <div className={styles.cardHeader}>
          <span className={styles.statusBadge}>
            <span className={styles.statusDot} aria-hidden="true" />
            Operational
          </span>
        </div>

        <h2 id="status-card-heading" className={styles.cardTitle}>
          Phase 1C: Admin Shell Active
        </h2>

        <p className={styles.cardDescription}>
          The administrative navigation framework, top utility bar, and responsive layout
          container are active. Future modules (Lead Inquiries, Vendor Partner Applications,
          and Operations Analytics) will be provisioned inside this shell in upcoming phases.
        </p>
      </section>
    </div>
  );
}
