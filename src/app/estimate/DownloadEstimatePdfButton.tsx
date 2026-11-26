"use client";

import { useEffect, useId, useReducer, useRef } from "react";
import type { PackageQuoteSelection } from "@/lib/package-quote";
import {
  ESTIMATE_DOWNLOAD_CONSENT_LABEL,
  ESTIMATE_DOWNLOAD_CONSENT_VERSION,
  ESTIMATE_DOWNLOAD_DISCLOSURE,
} from "@/lib/estimate-download-contact";
import {
  canContinue,
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

const SAVE_FAILED_FALLBACK =
  "We couldn't save your details just now, so the PDF wasn't downloaded. Please try again.";

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return res.arrayBuffer();
}

type SaveResult = { ok: true; captureId: string } | { ok: false; message: string };

/** Stores the contact and selection; the server prices the estimate itself. */
export async function saveEstimateDownload(
  selection: PackageQuoteSelection,
  contact: string,
  idempotencyKey: string,
): Promise<SaveResult> {
  try {
    const res = await fetch("/api/estimate-downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact,
        packageTier: selection.tierId,
        guestCount: selection.guestCount,
        serviceIds: selection.serviceIds,
        consentToContact: true,
        consentTextVersion: ESTIMATE_DOWNLOAD_CONSENT_VERSION,
        idempotencyKey,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success && typeof data.captureId === "string") {
      return { ok: true, captureId: data.captureId };
    }
    return { ok: false, message: typeof data?.message === "string" ? data.message : SAVE_FAILED_FALLBACK };
  } catch {
    return { ok: false, message: SAVE_FAILED_FALLBACK };
  }
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

/** Asks for a mobile number or email plus consent, stores it, then downloads the PDF. */
export default function DownloadEstimatePdfButton({
  selection,
  createdAtIso,
  initialGate = INITIAL_PDF_GATE,
}: Props) {
  const [gate, dispatch] = useReducer(pdfGateReducer, initialGate);
  // Set synchronously by closeGate so a save or build still running is discarded.
  const cancelRef = useRef<{ cancelled: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;
  const inputId = `${baseId}-contact`;
  const errorId = `${baseId}-error`;
  const consentId = `${baseId}-consent`;
  const consentErrorId = `${baseId}-consent-error`;

  const contact = parseContactInput(gate.value);
  const showContactError = gate.touched && !contact.ok;
  const showConsentError = gate.touched && contact.ok && !gate.consent;
  const busy = gate.status === "saving" || gate.status === "downloading";

  const closeGate = () => {
    if (cancelRef.current) cancelRef.current.cancelled = true;
    dispatch({ type: "close" });
  };

  // 1. Persist the contact; the PDF starts only after the server confirms.
  useEffect(() => {
    if (gate.status !== "saving" || !gate.idempotencyKey) return;
    const run = gate.run;
    const token = { cancelled: false };
    cancelRef.current = token;
    saveEstimateDownload(selection, gate.value, gate.idempotencyKey).then((result) => {
      if (token.cancelled) return;
      dispatch(
        result.ok
          ? { type: "saved", run, captureId: result.captureId }
          : { type: "saveFailed", run, message: result.message },
      );
    });
    // gate.value and the key cannot change while saving (the reducer blocks edits).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate.status, gate.run]);

  // 2. Build and download the PDF for a stored capture.
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
        dispatch({ type: "pdfFailed", run });
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

  const submit = () => dispatch({ type: "submit", newKey: crypto.randomUUID() });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => dispatch({ type: "open" })}
        disabled={busy}
        aria-haspopup="dialog"
        className={styles.secondaryAction}
      >
        {busy ? "Preparing PDF…" : "Download PDF"}
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
                submit();
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
                  // Continue is disabled while incomplete, so Enter would do nothing; show why instead.
                  if (e.key === "Enter" && !canContinue(gate)) dispatch({ type: "blur" });
                }}
                disabled={busy}
                aria-invalid={showContactError ? true : undefined}
                aria-describedby={showContactError ? errorId : undefined}
                placeholder="98765 43210 or name@example.com"
                className={`${styles.gateInput} ${showContactError ? styles.gateInputError : ""}`}
              />
              {showContactError && !contact.ok && (
                <p id={errorId} role="alert" className={styles.gateError}>
                  {contact.error}
                </p>
              )}

              <p id={`${consentId}-disclosure`} className={styles.gateNote}>
                {ESTIMATE_DOWNLOAD_DISCLOSURE}
              </p>
              <div className={styles.gateConsent}>
                <input
                  id={consentId}
                  type="checkbox"
                  required
                  checked={gate.consent}
                  onChange={(e) => dispatch({ type: "consent", checked: e.target.checked })}
                  disabled={busy}
                  aria-invalid={showConsentError ? true : undefined}
                  aria-describedby={
                    showConsentError
                      ? `${consentId}-disclosure ${consentErrorId}`
                      : `${consentId}-disclosure`
                  }
                />
                <label htmlFor={consentId}>{ESTIMATE_DOWNLOAD_CONSENT_LABEL}</label>
              </div>
              {showConsentError && (
                <p id={consentErrorId} role="alert" className={styles.gateError}>
                  Please tick the box to continue.
                </p>
              )}

              {gate.status === "saveFailed" && gate.message && (
                <p role="alert" className={styles.gateError}>
                  {gate.message}
                </p>
              )}
              {gate.status === "pdfFailed" && (
                <p role="alert" className={styles.gateError}>
                  Your details are saved, but the PDF couldn&apos;t be created. Please try again.
                </p>
              )}
              <div className={styles.gateActions}>
                <button
                  type="submit"
                  disabled={!canContinue(gate)}
                  aria-busy={busy}
                  className={styles.primaryAction}
                >
                  {gate.status === "saving"
                    ? "Saving your details…"
                    : gate.status === "downloading"
                      ? "Preparing PDF…"
                      : gate.status === "saveFailed" || gate.status === "pdfFailed"
                        ? "Try again"
                        : "Continue & download PDF"}
                </button>
                <button type="button" onClick={closeGate} className={styles.secondaryAction}>
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
