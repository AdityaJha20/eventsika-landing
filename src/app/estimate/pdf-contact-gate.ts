/**
 * Contact gate shown before the estimate PDF downloads.
 *
 * The value is only validated in the browser to unlock the download. It is not
 * sent, stored or logged: no approved endpoint exists for capturing a contact
 * on its own (`/api/leads` requires a full event enquiry).
 */

import { validateEmail } from "@/lib/backend/validation/email";
import { validateIndianPhone } from "@/lib/backend/validation/phone";

export type ContactInputResult =
  | { ok: true; kind: "phone" | "email" }
  | { ok: false; error: string };

/** Accepts one Indian mobile number (optionally +91) or one email address. */
export function parseContactInput(raw: string): ContactInputResult {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Enter your mobile number or email address." };
  if (value.includes("@")) {
    return validateEmail(value).isValid
      ? { ok: true, kind: "email" }
      : { ok: false, error: "Enter a valid email address, e.g. name@example.com." };
  }
  return validateIndianPhone(value).isValid
    ? { ok: true, kind: "phone" }
    : { ok: false, error: "Enter a valid 10-digit Indian mobile number, e.g. 98765 43210." };
}

export interface PdfGateState {
  open: boolean;
  value: string;
  /** Show the inline error only after the visitor has left the field or tried to continue. */
  touched: boolean;
  status: "idle" | "downloading" | "failed";
  /** Bumped on every start and on close; a finished build for an older run is discarded. */
  run: number;
}

export type PdfGateAction =
  | { type: "open" }
  | { type: "change"; value: string }
  | { type: "blur" }
  | { type: "submit" }
  | { type: "close" }
  | { type: "done"; run: number }
  | { type: "failed"; run: number };

export const INITIAL_PDF_GATE: PdfGateState = {
  open: false,
  value: "",
  touched: false,
  status: "idle",
  run: 0,
};

export function pdfGateReducer(state: PdfGateState, action: PdfGateAction): PdfGateState {
  switch (action.type) {
    case "open":
      return state.open ? state : { ...state, open: true, touched: false, status: "idle" };
    case "change":
      return { ...state, value: action.value, status: state.status === "failed" ? "idle" : state.status };
    case "blur":
      return { ...state, touched: true };
    case "submit":
      if (!state.open || state.status === "downloading") return state; // no duplicate downloads
      if (!parseContactInput(state.value).ok) return { ...state, touched: true };
      return { ...state, status: "downloading", run: state.run + 1 };
    case "close":
      // Cancels any build in progress: its run number no longer matches.
      return { ...state, open: false, touched: false, status: "idle", run: state.run + 1 };
    case "done":
      return action.run === state.run ? { ...state, open: false, status: "idle" } : state;
    case "failed":
      return action.run === state.run ? { ...state, status: "failed" } : state;
  }
}
