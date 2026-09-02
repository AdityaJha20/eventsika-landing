import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/backend/auth/require-admin";
import { LogoutButton } from "./LogoutButton";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Admin Portal | Eventsika",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const authResult = await requireAdminSession();

  if (!authResult.authorized) {
    redirect("/login");
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.brand}>Eventsika</span>
        <LogoutButton />
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Eventsika Admin Portal</h1>
          <p className={styles.description}>
            Authentication and authorization foundation verified. Administrative services and data
            management will be provisioned in the upcoming phase.
          </p>
          <LogoutButton />
        </div>
      </main>
    </div>
  );
}
