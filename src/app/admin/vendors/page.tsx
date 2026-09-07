import type { Metadata } from "next";
import { adminVendorService } from "@/lib/backend/services/admin-vendor-service";
import { VendorsWorkspace } from "./VendorsWorkspace";
import styles from "./vendors.module.css";

export const metadata: Metadata = {
  title: "Vendors | Eventsika Operations",
  description: "Operational vendor partner application registry.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminVendorsPage() {
  const result = await adminVendorService.getVendors();

  if (!result.success) {
    return (
      <div className={styles.vendorsContainer}>
        <header className={styles.commandHeader}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowDot} aria-hidden="true" />
              Registry Operations • Operational Register
            </p>
            <h1 className={styles.title}>Vendor Register</h1>
            <p className={styles.subtitle}>
              Operational registry of incoming vendor partnership applications.
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

  const { vendors, metrics } = result.data;

  return <VendorsWorkspace initialVendors={vendors} metrics={metrics} />;
}
