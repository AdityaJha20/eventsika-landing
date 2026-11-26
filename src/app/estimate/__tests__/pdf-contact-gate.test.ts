import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DownloadEstimatePdfButton from "../DownloadEstimatePdfButton";
import {
  INITIAL_PDF_GATE,
  parseContactInput,
  pdfGateReducer,
  type PdfGateAction,
  type PdfGateState,
} from "../pdf-contact-gate";
import Footer, { LEGAL_LINKS } from "@/components/Footer";

const selection = { tierId: "premium" as const, guestCount: 25, serviceIds: [] };

function run(...actions: PdfGateAction[]): PdfGateState {
  return actions.reduce(pdfGateReducer, INITIAL_PDF_GATE);
}

function render(gate: Partial<PdfGateState>): string {
  return renderToStaticMarkup(
    createElement(DownloadEstimatePdfButton, {
      selection,
      createdAtIso: "2026-11-18T00:00:00.000Z",
      initialGate: { ...INITIAL_PDF_GATE, ...gate },
    }),
  );
}

const submitButton = (html: string) =>
  html.match(/<button type="submit"[^>]*>[^<]*<\/button>/)?.[0] ?? "";

describe("parseContactInput", () => {
  it.each(["9876543210", "+91 98765 43210", "+919876543210", "  6123456789  "])(
    "accepts mobile %j",
    (raw) => expect(parseContactInput(raw)).toEqual({ ok: true, kind: "phone" }),
  );

  it.each(["name@gmail.com", "a.b@company.co.in", "someone@outlook.com", "x+tag@proton.me"])(
    "accepts email from any provider %j",
    (raw) => expect(parseContactInput(raw)).toEqual({ ok: true, kind: "email" }),
  );

  it.each([
    ["", "Enter your mobile number or email address."],
    ["12345", "10-digit Indian mobile"],
    ["5876543210", "10-digit Indian mobile"],
    ["98765432101", "10-digit Indian mobile"],
    ["abcdef", "10-digit Indian mobile"],
    ["name@", "valid email"],
    ["@example.com", "valid email"],
    ["name@example", "valid email"],
  ])("rejects %j", (raw, message) => {
    const result = parseContactInput(raw);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(message);
  });
});

describe("PDF gate flow", () => {
  it("opens and closes without downloading", () => {
    const opened = run({ type: "open" });
    expect(opened.open).toBe(true);
    const closed = pdfGateReducer(opened, { type: "close" });
    expect(closed).toMatchObject({ open: false, status: "idle" });
  });

  it("blocks the download until the input is valid", () => {
    const invalid = run({ type: "open" }, { type: "change", value: "12345" }, { type: "submit" });
    expect(invalid.status).toBe("idle");
    expect(invalid.touched).toBe(true);
    const empty = run({ type: "open" }, { type: "submit" });
    expect(empty.status).toBe("idle");
  });

  it.each(["9876543210", "name@example.com"])("starts the download after a valid %j", (value) => {
    const state = run({ type: "open" }, { type: "change", value }, { type: "submit" });
    expect(state.status).toBe("downloading");
    const done = pdfGateReducer(state, { type: "done", run: state.run });
    expect(done).toMatchObject({ open: false, status: "idle" });
  });

  it("ignores repeated submits while a download is in progress", () => {
    const first = run({ type: "open" }, { type: "change", value: "9876543210" }, { type: "submit" });
    const again = pdfGateReducer(first, { type: "submit" });
    expect(again).toBe(first);
    expect(pdfGateReducer(first, { type: "open" })).toBe(first);
  });

  it("closing cancels an in-flight download: its result is discarded", () => {
    const started = run({ type: "open" }, { type: "change", value: "9876543210" }, { type: "submit" });
    const cancelled = pdfGateReducer(started, { type: "close" });
    expect(cancelled).toMatchObject({ open: false, status: "idle" });
    expect(cancelled.run).not.toBe(started.run);
    // The component only saves the file while its run is current.
    expect(pdfGateReducer(cancelled, { type: "done", run: started.run })).toBe(cancelled);
    expect(pdfGateReducer(cancelled, { type: "failed", run: started.run })).toBe(cancelled);
  });

  it("a failed build keeps the modal open and allows a retry", () => {
    const started = run({ type: "open" }, { type: "change", value: "name@example.com" }, { type: "submit" });
    const failed = pdfGateReducer(started, { type: "failed", run: started.run });
    expect(failed).toMatchObject({ open: true, status: "failed" });
    expect(pdfGateReducer(failed, { type: "submit" }).status).toBe("downloading");
  });
});

describe("PDF gate markup", () => {
  it("closed: only the Download PDF trigger, no dialog", () => {
    const html = render({});
    expect(html).toMatch(/<button type="button"[^>]*>Download PDF<\/button>/);
    expect(html).not.toContain('role="dialog"');
  });

  it("open: labelled modal dialog with a labelled input and disabled Continue", () => {
    const html = render({ open: true });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(html).toContain(`id="${labelledBy}"`);
    const inputId = html.match(/<input[^>]*id="([^"]+)"/)?.[1];
    expect(html).toContain(`<label for="${inputId}"`);
    expect(submitButton(html)).toMatch(/disabled=""/);
    expect(html).toContain("Close and cancel download");
    expect(html).toContain("It is not sent to Eventsika or saved.");
  });

  it("invalid input after leaving the field: inline error wired to the input", () => {
    const html = render({ open: true, value: "12345", touched: true });
    const input = html.match(/<input[^>]*>/)?.[0] ?? "";
    expect(input).toContain('aria-invalid="true"');
    const describedBy = input.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(html).toMatch(new RegExp(`id="${describedBy}" role="alert"[^>]*>Enter a valid 10-digit`));
    expect(submitButton(html)).toMatch(/disabled=""/);
  });

  it.each(["+91 98765 43210", "name@example.com"])("valid %j enables Continue", (value) => {
    const html = render({ open: true, value, touched: true });
    expect(submitButton(html)).not.toMatch(/disabled=""/);
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("while downloading both triggers are disabled", () => {
    const html = render({ open: true, value: "9876543210", status: "downloading", run: 1 });
    expect(submitButton(html)).toMatch(/disabled=""/);
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>Preparing PDF…<\/button>/);
  });

  it("a cancelled build never saves the file (cancel flag is set synchronously on close)", () => {
    const source = readFileSync(path.resolve("src/app/estimate/DownloadEstimatePdfButton.tsx"), "utf8");
    const guard = source.indexOf("if (!isCurrent()) return;");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(source.indexOf("link.click()"));
    expect(source).toMatch(/const closeGate = \(\) => \{\s*if \(cancelRef\.current\) cancelRef\.current\.cancelled = true;/);
    // Every close path goes through closeGate.
    expect(source).not.toMatch(/onClick=\{\(\) => dispatch\(\{ type: "close" \}\)\}/);
  });

  it("never sends or logs the contact value", () => {
    for (const file of ["DownloadEstimatePdfButton.tsx", "pdf-contact-gate.ts"]) {
      const source = readFileSync(path.resolve("src/app/estimate", file), "utf8");
      expect(source).not.toMatch(/fetch\([^)]*\/api\//);
      expect(source).not.toMatch(/sendBeacon|XMLHttpRequest/);
      expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
      expect(source).not.toMatch(/console\.\w+\([^)]*gate\.value/);
    }
  });
});

describe("footer legal links (EVT-004/006/008/009)", () => {
  it("renders no placeholder or unapproved legal links", () => {
    const html = renderToStaticMarkup(createElement(Footer));
    expect(LEGAL_LINKS).toHaveLength(0);
    expect(html).not.toContain('href="#"');
    expect(html).not.toMatch(/Privacy Policy|Terms &amp; Conditions/);
  });
});
