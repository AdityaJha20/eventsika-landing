"use client";

import Link from "next/link";
import { CONSULTATION_HREF, hasSubmittedLead } from "@/lib/lead-completion";
import styles from "./estimate.module.css";

/**
 * Default: the homepage enquiry form (#plan-event), prefilled with this estimate.
 * After an enquiry the API confirmed in this browser session: the consultation booking page.
 */
export default function ContactEstimateLink({ quoteHref }: { quoteHref: string }) {
  return (
    <Link
      href={quoteHref}
      className={styles.primaryAction}
      onClick={(event) => {
        if (hasSubmittedLead()) {
          event.preventDefault();
          window.location.assign(CONSULTATION_HREF);
        }
      }}
    >
      Contact Eventsika about this estimate
    </Link>
  );
}
