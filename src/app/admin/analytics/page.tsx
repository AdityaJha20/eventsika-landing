import type { Metadata } from "next";
import { adminAnalyticsService } from "@/lib/backend/services/admin-analytics-service";
import { AnalyticsWorkspace } from "./AnalyticsWorkspace";
import styles from "./analytics.module.css";

export const metadata: Metadata = {
  title: "Analytics | Eventsika Concierge Operations",
  description: "Executive operational celebration analytics and geographic demand intelligence.",
  robots: {
    index: false,
    follow: false,
  },
};

interface AdminAnalyticsPageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
  const resolvedParams = await searchParams;
  const result = await adminAnalyticsService.getAnalyticsData(resolvedParams.range);

  if (!result.success) {
    return (
      <div className={styles.analyticsContainer}>
        <header className={styles.headerSection}>
          <div className={styles.headerCopy}>
            <span className={styles.eyebrow}>Analytics</span>
            <h1 className={styles.title}>Celebrations in Focus</h1>
            <p className={styles.subtitle}>
              Real insights. Better decisions. Greater celebrations.
            </p>
          </div>
        </header>

        <section className={styles.errorCard} aria-live="polite">
          <h2 className={styles.errorTitle}>Operational Notice</h2>
          <p className={styles.errorMessage}>{result.error}</p>
        </section>
      </div>
    );
  }

  return (
    <AnalyticsWorkspace
      initialData={result.data}
      activeRange={result.data.range}
    />
  );
}
