"use client";

import { useEffect, useId, useReducer, useRef } from "react";
import type { PackageQuoteSelection } from "@/lib/package-quote";
import {
  INITIAL_PDF_GATE,
  parseContactInput,
  pdfGateReducer,
  type PdfGateState,
} from "./pdf-contact-gate";
import styles from "./estimate.module.css";

interface Props {
  selection: PackageQuoteSelection;
  createdAtIso: string;
  /** Initial gate state; for tests. */
  initialGate?: PdfGateState;
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return res.arrayBuffer();
}

/**
 * Builds the estimate PDF in the browser and downloads it directly (no print dialog).
 * `isCurrent` is checked just before saving so a cancelled request never downloads.
 */
async function downloadEstimatePdf(
  selection: PackageQuoteSelection,
  createdAtIso: string,
  isCurrent: () => boolean,
): Promise<void> {
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
  if (!isCurrent()) return;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = estimatePdfFilename(selection);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Asks for a mobile number or email (validated on the device only), then downloads the PDF. */
export default function DownloadEstimatePdfButton({
  selection,
  createdAtIso,
  initialGate = INITIAL_PDF_GATE,
}: Props) {
  const [gate, dispatch] = useReducer(pdfGateReducer, initialGate);
  // Set synchronously by closeGate so a build that is still running never saves the file.
  const cancelRef = useRef<{ cancelled: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;
  const inputId = `${baseId}-contact`;
  const errorId = `${baseId}-error`;

  const contact = parseContactInput(gate.value);
  const showError = gate.touched && !contact.ok;
  const downloading = gate.status === "downloading";

  const closeGate = () => {
    if (cancelRef.current) cancelRef.current.cancelled = true;
    dispatch({ type: "close" });
  };

  // Start the build once per submitted run.
  useEffect(() => {
    if (gate.status !== "downloading") return;
    const run = gate.run;
    const token = { cancelled: false };
    cancelRef.current = token;
    downloadEstimatePdf(selection, createdAtIso, () => !token.cancelled)
      .then(() => dispatch({ type: "done", run }))
      .catch((error) => {
        // Only the build failure is logged, never the contact value.
        console.error("Estimate PDF download failed:", error);
        dispatch({ type: "failed", run });
      });
  }, [gate.status, gate.run, selection, createdAtIso]);

  // Focus, Escape, focus trap and scroll lock while open; focus returns to the trigger on close.
  useEffect(() => {
    if (!gate.open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeGate();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled])",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [gate.open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => dispatch({ type: "open" })}
        disabled={downloading}
        aria-haspopup="dialog"
        className={styles.secondaryAction}
      >
        {downloading ? "Preparing PDF…" : "Download PDF"}
      </button>

      {gate.open && (
        <div
          className={styles.gateBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeGate();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className={styles.gateDialog}
          >
            <button
              type="button"
              onClick={closeGate}
              aria-label="Close and cancel download"
              className={styles.gateClose}
            >
              ×
            </button>
            <h2 id={titleId} className={styles.gateTitle}>
              Download your estimate
            </h2>
            <p id={descId} className={styles.gateText}>
              Enter your mobile number or email address to download the PDF. One is enough.
            </p>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: "submit" });
              }}
            >
              <label htmlFor={inputId} className={styles.gateLabel}>
                Mobile number or email address
              </label>
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                autoComplete="email"
                value={gate.value}
                onChange={(e) => dispatch({ type: "change", value: e.target.value })}
                onBlur={() => dispatch({ type: "blur" })}
                onKeyDown={(e) => {
                  // Continue is disabled while invalid, so Enter would do nothing; show why instead.
                  if (e.key === "Enter" && !contact.ok) dispatch({ type: "blur" });
                }}
                disabled={downloading}
                aria-invalid={showError ? true : undefined}
                aria-describedby={showError ? errorId : undefined}
                placeholder="98765 43210 or name@example.com"
                className={`${styles.gateInput} ${showError ? styles.gateInputError : ""}`}
              />
              {showError && !contact.ok && (
                <p id={errorId} role="alert" className={styles.gateError}>
                  {contact.error}
                </p>
              )}
              <p className={styles.gateNote}>
                This is only checked on your device to unlock the download. It is not sent to
                Eventsika or saved.
              </p>
              {gate.status === "failed" && (
                <p role="alert" className={styles.gateError}>
                  The PDF couldn&apos;t be created. Please try again.
                </p>
              )}
              <div className={styles.gateActions}>
                <button
                  type="submit"
                  disabled={!contact.ok || downloading}
                  aria-busy={downloading}
                  className={styles.primaryAction}
                >
                  {downloading ? "Preparing PDF…" : "Continue & download PDF"}
                </button>
                <button
                  type="button"
                  onClick={closeGate}
                  className={styles.secondaryAction}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
