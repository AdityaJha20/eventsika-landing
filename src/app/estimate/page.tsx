import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { parsePackageQuoteParams } from "@/lib/package-quote";
import EstimateDocument from "./EstimateDocument";
import styles from "./estimate.module.css";

export const metadata: Metadata = {
  title: "Indicative Event Estimate",
  description:
    "Your indicative Eventsika event estimate: decor package and selected optional services, priced per guest.",
  robots: { index: false, follow: false },
};

export default async function EstimatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const selection = parsePackageQuoteParams(await searchParams);

  return (
    <>
      <div className={styles.screenOnly}>
        <Navbar />
      </div>
      <main id="main-content" className={styles.page}>
        <EstimateDocument selection={selection} createdAt={new Date()} />
      </main>
      <div className={styles.screenOnly}>
        <Footer />
      </div>
    </>
  );
}
