"use client";

import { useState } from "react";
import type { PackageQuoteSelection } from "@/lib/package-quote";
import styles from "./estimate.module.css";

interface Props {
  selection: PackageQuoteSelection;
  createdAtIso: string;
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return res.arrayBuffer();
}

/** Builds the estimate PDF in the browser and downloads it directly (no print dialog). */
export default function DownloadEstimatePdfButton({ selection, createdAtIso }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    setFailed(false);
    try {
      // Loaded on demand so pdf-lib and the fonts never weigh on the initial page.
      const [{ buildEstimatePdf, buildEstimatePdfModel, estimatePdfFilename }, bodyFont, displayFont, logoPng] =
        await Promise.all([
          import("@/lib/estimate-pdf"),
          fetchBytes("/fonts/Inter.ttf"),
          fetchBytes("/fonts/PlayfairDisplay.ttf"),
          fetchBytes("/images/eventsika-official-logo.png"),
        ]);
      const bytes = await buildEstimatePdf(
        buildEstimatePdfModel(selection, new Date(createdAtIso)),
        { bodyFont, displayFont, logoPng },
      );
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = estimatePdfFilename(selection);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error("Estimate PDF download failed:", error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
        className={styles.secondaryAction}
      >
        {busy ? "Preparing PDF…" : "Download PDF"}
      </button>
      {failed && (
        <p role="alert" className={styles.emptyServices}>
          The PDF couldn&apos;t be created. Please try again.
        </p>
      )}
    </>
  );
}
