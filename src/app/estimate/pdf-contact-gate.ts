/**
 * Contact gate shown before the estimate PDF downloads.
 *
 * Sequence: valid mobile/email + consent -> POST /api/estimate-downloads ->
 * only after the server confirms the record is stored does the PDF build start.
 * The idempotency key is kept for the same contact, so retries after a failed
 * save never create a second record, and a failed PDF build retries with the
 * capture that was already saved.
 */

import { parseEstimateContact } from "@/lib/estimate-download-contact";

export type ContactInputResult =
  | { ok: true; kind: "phone" | "email" }
  | { ok: false; error: string };

/** Accepts one Indian mobile number (optionally +91) or one email address. */
export function parseContactInput(raw: string): ContactInputResult {
  const result = parseEstimateContact(raw);
  return result.ok ? { ok: true, kind: result.kind } : result;
}

export type PdfGateStatus = "idle" | "saving" | "downloading" | "saveFailed" | "pdfFailed";

export interface PdfGateState {
  open: boolean;
  value: string;
  consent: boolean;
  /** Show inline errors only after the visitor has left the field or tried to continue. */
  touched: boolean;
  status: PdfGateStatus;
  /** Server message for a failed save. */
  message: string | null;
  /** Reused for every save attempt for the current contact. */
  idempotencyKey: string | null;
  /** Stored record for the current contact; set once the server confirms the save. */
  captureId: string | null;
  /** Bumped on every start and on close; results for an older run are discarded. */
  run: number;
}

export type PdfGateAction =
  | { type: "open" }
  | { type: "change"; value: string }
  | { type: "blur" }
  | { type: "consent"; checked: boolean }
  | { type: "submit"; newKey: string }
  | { type: "saved"; run: number; captureId: string }
  | { type: "saveFailed"; run: number; message: string }
  | { type: "done"; run: number }
  | { type: "pdfFailed"; run: number }
  | { type: "close" };

export const INITIAL_PDF_GATE: PdfGateState = {
  open: false,
  value: "",
  consent: false,
  touched: false,
  status: "idle",
  message: null,
  idempotencyKey: null,
  captureId: null,
  run: 0,
};

const isBusy = (state: PdfGateState) => state.status === "saving" || state.status === "downloading";

export function canContinue(state: PdfGateState): boolean {
  return parseContactInput(state.value).ok && state.consent && !isBusy(state);
}

export function pdfGateReducer(state: PdfGateState, action: PdfGateAction): PdfGateState {
  switch (action.type) {
    case "open":
      return state.open ? state : { ...state, open: true, touched: false, status: "idle", message: null };
    case "change": {
      if (isBusy(state)) return state;
      const contactChanged = action.value.trim() !== state.value.trim();
      return {
        ...state,
        value: action.value,
        status: "idle",
        message: null,
        // A different contact is a different record.
        ...(contactChanged ? { idempotencyKey: null, captureId: null } : {}),
      };
    }
    case "blur":
      return { ...state, touched: true };
    case "consent":
      return isBusy(state) ? state : { ...state, consent: action.checked };
    case "submit":
      if (!state.open || isBusy(state)) return state; // no duplicate saves or downloads
      if (!canContinue(state)) return { ...state, touched: true };
      if (state.captureId) {
        // Already stored: retry only the PDF.
        return { ...state, status: "downloading", message: null, run: state.run + 1 };
      }
      return {
        ...state,
        status: "saving",
        message: null,
        idempotencyKey: state.idempotencyKey ?? action.newKey,
        run: state.run + 1,
      };
    case "saved":
      return action.run === state.run && state.status === "saving"
        ? { ...state, status: "downloading", captureId: action.captureId }
        : state;
    case "saveFailed":
      return action.run === state.run && state.status === "saving"
        ? { ...state, status: "saveFailed", message: action.message }
        : state;
    case "done":
      return action.run === state.run && state.status === "downloading"
        ? { ...state, open: false, status: "idle" }
        : state;
    case "pdfFailed":
      return action.run === state.run && state.status === "downloading"
        ? { ...state, status: "pdfFailed" }
        : state;
    case "close":
      // Cancels any save or build in progress (its run no longer matches). The
      // key and capture are kept, so reopening never creates a duplicate.
      return { ...state, open: false, touched: false, status: "idle", message: null, run: state.run + 1 };
  }
}
