import Image from "next/image";
import Link from "next/link";
import {
  BASE_PACKAGE_INCLUSION,
  calculatePackageEstimate,
  estimateLineItems,
  formatCurrency,
  formatPerPersonRate,
  getPackageTier,
} from "@/lib/packages-config";
import {
  buildPackageQuoteHref,
  type PackageQuoteSelection,
} from "@/lib/package-quote";
import PrintEstimateButton from "./PrintEstimateButton";
import styles from "./estimate.module.css";

export const ESTIMATE_PAGE_DISCLAIMER =
  "This is an indicative estimate, not an invoice or a request for payment. Each package includes decor only; optional services are charged per guest only when selected. Supplier availability, the final proposal and tax treatment require confirmation with Eventsika.";

/** Long-form date in Indian English, in India Standard Time. */
export function formatEstimateDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

interface EstimateDocumentProps {
  selection: PackageQuoteSelection | null;
  createdAt: Date;
}

export default function EstimateDocument({ selection, createdAt }: EstimateDocumentProps) {
  if (!selection) {
    return (
      <section className={styles.recovery} aria-labelledby="estimate-recovery-heading">
        <h1 id="estimate-recovery-heading" className={styles.recoveryTitle}>
          We couldn&apos;t load this estimate
        </h1>
        <p className={styles.recoveryText}>
          The estimate link is incomplete or no longer matches our current
          packages, so no figures can be shown. Please rebuild your estimate
          with the calculator.
        </p>
        <Link href="/packages#customizer" className={styles.primaryAction}>
          Return to the estimate calculator
        </Link>
      </section>
    );
  }

  const estimate = calculatePackageEstimate(
    selection.guestCount,
    selection.tierId,
    selection.serviceIds,
  );
  const tier = getPackageTier(estimate.tierId);
  const [decorLine, ...serviceLines] = estimateLineItems(estimate);

  return (
    <article className={styles.document} aria-labelledby="estimate-heading">
      <header className={styles.documentHeader}>
        <Image
          src="/images/eventsika-official-logo.png"
          alt="Eventsika"
          width={196}
          height={63}
          priority
          className={styles.logo}
        />
        <div className={styles.headingBlock}>
          <p className={styles.eyebrow}>Celebration Planning</p>
          <h1 id="estimate-heading" className={styles.title}>
            Indicative Event Estimate
          </h1>
        </div>
      </header>

      <dl className={styles.metaGrid}>
        <div className={styles.metaItem}>
          <dt>Package</dt>
          <dd>{tier.name}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Guests</dt>
          <dd>{estimate.guestCount}</dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Estimate date</dt>
          <dd>
            <time dateTime={createdAt.toISOString()}>{formatEstimateDate(createdAt)}</time>
          </dd>
        </div>
        <div className={styles.metaItem}>
          <dt>Package includes</dt>
          <dd>{BASE_PACKAGE_INCLUSION}</dd>
        </div>
      </dl>

      <section aria-labelledby="estimate-items-heading" className={styles.itemsSection}>
        <h2 id="estimate-items-heading" className={styles.sectionTitle}>
          Itemised Breakdown
        </h2>
        <table className={styles.itemsTable}>
          <caption className={styles.visuallyHidden}>
            Decor package and selected optional services, charged per guest
          </caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Rate per person</th>
              <th scope="col">Guests</th>
              <th scope="col">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {[decorLine, ...serviceLines].map((line) => (
              <tr key={line.id} data-line-id={line.id}>
                <th scope="row" data-label="Item">
                  {line.label}
                  {line.id === "decor" && (
                    <span className={styles.lineNote}>Includes decor only</span>
                  )}
                </th>
                <td data-label="Rate per person">{formatPerPersonRate(line.ratePerPerson)}</td>
                <td data-label="Guests">{line.quantity}</td>
                <td data-label="Subtotal">{formatCurrency(line.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {serviceLines.length === 0 && (
          <p className={styles.emptyServices} role="status">
            No optional services selected
          </p>
        )}
      </section>

      <section aria-labelledby="estimate-totals-heading" className={styles.totalsSection}>
        <h2 id="estimate-totals-heading" className={styles.visuallyHidden}>
          Estimate totals
        </h2>
        <dl className={styles.totals}>
          <div className={styles.totalRow}>
            <dt>Decor package subtotal</dt>
            <dd>{formatCurrency(estimate.packageSubtotal)}</dd>
          </div>
          <div className={styles.totalRow}>
            <dt>Selected services subtotal</dt>
            <dd>
              {serviceLines.length > 0
                ? formatCurrency(estimate.servicesSubtotal)
                : "None selected"}
            </dd>
          </div>
          <div className={styles.totalRow}>
            <dt>Total per person</dt>
            <dd>{formatPerPersonRate(estimate.perPersonTotal)}</dd>
          </div>
          <div className={`${styles.totalRow} ${styles.grandTotal}`}>
            <dt>Indicative grand total</dt>
            <dd>{formatCurrency(estimate.total)}</dd>
          </div>
        </dl>
      </section>

      <p className={styles.disclaimer}>{ESTIMATE_PAGE_DISCLAIMER}</p>

      <div className={styles.actions}>
        <Link href={buildPackageQuoteHref(selection)} className={styles.primaryAction}>
          Contact Eventsika about this estimate
        </Link>
        <PrintEstimateButton />
        <Link href="/packages#customizer" className={styles.textAction}>
          Back to the estimate calculator
        </Link>
      </div>

      <footer className={styles.documentFooter}>
        <span>Eventsika · care@eventsika.in · eventsika.in</span>
      </footer>
    </article>
  );
}
