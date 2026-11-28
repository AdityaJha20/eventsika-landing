import type { Metadata } from "next";
import { adminPaymentService } from "@/lib/backend/services/admin-payment-service";
import { requireFinanceAdminSession } from "@/lib/backend/auth/require-admin";
import { PaymentsWorkspace } from "./PaymentsWorkspace";
import styles from "./payments.module.css";

export const metadata: Metadata = {
  title: "Payments | Eventsika Concierge Operations",
  description: "Payment attempts, refunds, slot conflicts and reconciliation cases.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  // The admin layout already requires an admin session; financial actions need more.
  const [result, finance] = await Promise.all([adminPaymentService.getOverview(), requireFinanceAdminSession()]);

  if (!result.success) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Payments</h1>
        <section className={styles.notice} aria-live="polite">
          {result.error}
        </section>
      </div>
    );
  }

  return <PaymentsWorkspace data={result.data} canManageFinance={finance.authorized} />;
}
