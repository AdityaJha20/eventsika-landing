import type { Metadata } from "next";
import { adminLeadService } from "@/lib/backend/services/admin-lead-service";
import { LeadsWorkspace } from "./LeadsWorkspace";
import styles from "./leads.module.css";

export const metadata: Metadata = {
  title: "Leads | Eventsika Concierge Operations",
  description: "Operational celebration inquiry queue and client dossiers.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLeadsPage() {
  const result = await adminLeadService.getLeads();

  if (!result.success) {
    return (
      <div className={styles.leadsContainer}>
        <header className={styles.commandHeader}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              Celebration Inquiries • Operational Queue
            </p>
            <h1 className={styles.title}>Leads</h1>
            <p className={styles.subtitle}>
              Manage and respond to celebration inquiries.
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

  const { leads, metrics } = result.data;

  return <LeadsWorkspace initialLeads={leads} metrics={metrics} />;
}
