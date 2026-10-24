"use client";

import styles from "./estimate.module.css";

export default function PrintEstimateButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={styles.secondaryAction}
    >
      Print / Save as PDF
    </button>
  );
}
