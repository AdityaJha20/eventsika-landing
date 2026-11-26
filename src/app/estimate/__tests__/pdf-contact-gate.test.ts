import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import DownloadEstimatePdfButton, { saveEstimateDownload } from "../DownloadEstimatePdfButton";
import {
  canContinue,
  INITIAL_PDF_GATE,
  parseContactInput,
  pdfGateReducer,
  type PdfGateAction,
  type PdfGateState,
} from "../pdf-contact-gate";
import {
  ESTIMATE_DOWNLOAD_CONSENT_LABEL,
  ESTIMATE_DOWNLOAD_CONSENT_VERSION,
  ESTIMATE_DOWNLOAD_DISCLOSURE,
} from "@/lib/estimate-download-contact";
import Footer, { LEGAL_LINKS } from "@/components/Footer";

const selection = { tierId: "premium" as const, guestCount: 25, serviceIds: ["food" as const] };
const KEY_A = "11111111-1111-4111-8111-111111111111";
const KEY_B = "22222222-2222-4222-8222-222222222222";
const submit = (newKey = KEY_A): PdfGateAction => ({ type: "submit", newKey });

function run(...actions: PdfGateAction[]): PdfGateState {
  return actions.reduce(pdfGateReducer, INITIAL_PDF_GATE);
}

/** Opened, valid contact, consent given. */
function ready(value = "9876543210"): PdfGateState {
  return run({ type: "open" }, { type: "change", value }, { type: "consent", checked: true });
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

afterEach(() => vi.unstubAllGlobals());

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

describe("PDF gate flow: save first, then download", () => {
  it("opens and closes without saving or downloading", () => {
    const opened = run({ type: "open" });
    expect(opened.open).toBe(true);
    expect(pdfGateReducer(opened, { type: "close" })).toMatchObject({ open: false, status: "idle" });
  });

  it("requires a valid contact AND consent before anything is sent", () => {
    const noConsent = run({ type: "open" }, { type: "change", value: "9876543210" }, submit());
    expect(noConsent).toMatchObject({ status: "idle", touched: true, idempotencyKey: null });
    expect(canContinue(noConsent)).toBe(false);

    const badContact = run(
      { type: "open" },
      { type: "change", value: "12345" },
      { type: "consent", checked: true },
      submit(),
    );
    expect(badContact.status).toBe("idle");
    expect(run({ type: "open" }, submit()).status).toBe("idle");
  });

  it.each(["9876543210", "name@example.com"])("valid %j + consent starts saving, not downloading", (value) => {
    const saving = pdfGateReducer(ready(value), submit());
    expect(saving).toMatchObject({ status: "saving", idempotencyKey: KEY_A });
  });

  it("PDF generation starts only after the server confirms the save", () => {
    const saving = pdfGateReducer(ready(), submit());
    // A stray "done"/"pdfFailed" cannot skip the save.
    expect(pdfGateReducer(saving, { type: "done", run: saving.run })).toBe(saving);
    const saved = pdfGateReducer(saving, { type: "saved", run: saving.run, captureId: "cap-1" });
    expect(saved).toMatchObject({ status: "downloading", captureId: "cap-1" });
    expect(pdfGateReducer(saved, { type: "done", run: saved.run })).toMatchObject({ open: false, status: "idle" });
  });

  it("save failure: no download, error shown, retry reuses the same idempotency key", () => {
    const saving = pdfGateReducer(ready(), submit(KEY_A));
    const failed = pdfGateReducer(saving, { type: "saveFailed", run: saving.run, message: "DB down" });
    expect(failed).toMatchObject({ status: "saveFailed", message: "DB down", captureId: null });
    const retry = pdfGateReducer(failed, submit(KEY_B));
    expect(retry).toMatchObject({ status: "saving", idempotencyKey: KEY_A });
  });

  it("PDF failure after a successful save retries the PDF only (no second save)", () => {
    const saving = pdfGateReducer(ready(), submit());
    const saved = pdfGateReducer(saving, { type: "saved", run: saving.run, captureId: "cap-1" });
    const pdfFailed = pdfGateReducer(saved, { type: "pdfFailed", run: saved.run });
    expect(pdfFailed).toMatchObject({ open: true, status: "pdfFailed", captureId: "cap-1" });
    const retry = pdfGateReducer(pdfFailed, submit(KEY_B));
    expect(retry.status).toBe("downloading");
    expect(retry.idempotencyKey).toBe(KEY_A);
  });

  it("repeated clicks while saving or downloading are ignored", () => {
    const saving = pdfGateReducer(ready(), submit());
    expect(pdfGateReducer(saving, submit(KEY_B))).toBe(saving);
    const saved = pdfGateReducer(saving, { type: "saved", run: saving.run, captureId: "cap-1" });
    expect(pdfGateReducer(saved, submit(KEY_B))).toBe(saved);
    expect(pdfGateReducer(saved, { type: "change", value: "x" })).toBe(saved);
  });

  it("downloading again for the same contact reuses the stored capture", () => {
    const saving = pdfGateReducer(ready(), submit());
    const saved = pdfGateReducer(saving, { type: "saved", run: saving.run, captureId: "cap-1" });
    const closed = pdfGateReducer(saved, { type: "done", run: saved.run });
    const again = [{ type: "open" } as const, submit(KEY_B)].reduce(pdfGateReducer, closed);
    expect(again).toMatchObject({ status: "downloading", captureId: "cap-1", idempotencyKey: KEY_A });
  });

  it("a different contact gets a new record (new key)", () => {
    const saving = pdfGateReducer(ready("9876543210"), submit(KEY_A));
    const saved = pdfGateReducer(saving, { type: "saved", run: saving.run, captureId: "cap-1" });
    const failed = pdfGateReducer(saved, { type: "pdfFailed", run: saved.run });
    const changed = pdfGateReducer(failed, { type: "change", value: "name@example.com" });
    expect(changed).toMatchObject({ captureId: null, idempotencyKey: null });
    expect(pdfGateReducer(changed, submit(KEY_B))).toMatchObject({ status: "saving", idempotencyKey: KEY_B });
  });

  it("closing cancels a save or build in flight; reopening keeps the key so no duplicate is created", () => {
    const saving = pdfGateReducer(ready(), submit(KEY_A));
    const closed = pdfGateReducer(saving, { type: "close" });
    expect(closed).toMatchObject({ open: false, status: "idle" });
    expect(pdfGateReducer(closed, { type: "saved", run: saving.run, captureId: "cap-1" })).toBe(closed);
    const resubmit = [{ type: "open" } as const, submit(KEY_B)].reduce(pdfGateReducer, closed);
    expect(resubmit.idempotencyKey).toBe(KEY_A);

    const saved = pdfGateReducer(resubmit, { type: "saved", run: resubmit.run, captureId: "cap-1" });
    const cancelled = pdfGateReducer(saved, { type: "close" });
    expect(pdfGateReducer(cancelled, { type: "done", run: saved.run })).toBe(cancelled);
  });
});

describe("saveEstimateDownload (browser request)", () => {
  it("sends only the selection, contact, consent and key: no prices", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, captureId: "cap-9" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await saveEstimateDownload(selection, "name@example.com", KEY_A);
    expect(result).toEqual({ ok: true, captureId: "cap-9" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/estimate-downloads");
    expect(JSON.parse(init.body)).toEqual({
      contact: "name@example.com",
      packageTier: "premium",
      guestCount: 25,
      serviceIds: ["food"],
      consentToContact: true,
      consentTextVersion: ESTIMATE_DOWNLOAD_CONSENT_VERSION,
      idempotencyKey: KEY_A,
    });
  });

  it("reports server and network failures without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, message: "Nope" }), { status: 503 })),
    );
    expect(await saveEstimateDownload(selection, "9876543210", KEY_A)).toEqual({ ok: false, message: "Nope" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const offline = await saveEstimateDownload(selection, "9876543210", KEY_A);
    expect(offline.ok).toBe(false);
  });
});

describe("PDF gate markup", () => {
  it("closed: only the Download PDF trigger, no dialog", () => {
    const html = render({});
    expect(html).toMatch(/<button type="button"[^>]*>Download PDF<\/button>/);
    expect(html).not.toContain('role="dialog"');
  });

  it("open: labelled dialog, consent disclosure and a required checkbox; Continue disabled", () => {
    const html = render({ open: true });
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const inputId = html.match(/<input[^>]*type="text"[^>]*>/)?.[0].match(/id="([^"]+)"/)?.[1];
    expect(html).toContain(`<label for="${inputId}"`);
    expect(html).toContain(ESTIMATE_DOWNLOAD_DISCLOSURE);
    const checkbox = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] ?? "";
    expect(checkbox).toContain('required=""');
    expect(checkbox).not.toContain("checked");
    const checkboxId = checkbox.match(/id="([^"]+)"/)?.[1];
    expect(html).toContain(`<label for="${checkboxId}">${ESTIMATE_DOWNLOAD_CONSENT_LABEL}</label>`);
    expect(submitButton(html)).toMatch(/disabled=""/);
    // The old "not saved" message is gone.
    expect(html).not.toMatch(/not sent to Eventsika or saved/);
  });

  it("valid contact without consent keeps Continue disabled and explains why", () => {
    const html = render({ open: true, value: "9876543210", touched: true });
    expect(submitButton(html)).toMatch(/disabled=""/);
    expect(html).toContain("Please tick the box to continue.");
  });

  it("invalid contact: inline error wired to the input", () => {
    const html = render({ open: true, value: "12345", touched: true, consent: true });
    const input = html.match(/<input[^>]*type="text"[^>]*>/)?.[0] ?? "";
    expect(input).toContain('aria-invalid="true"');
    const describedBy = input.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(html).toMatch(new RegExp(`id="${describedBy}" role="alert"[^>]*>Enter a valid 10-digit`));
    expect(submitButton(html)).toMatch(/disabled=""/);
  });

  it.each(["+91 98765 43210", "name@example.com"])("valid %j with consent enables Continue", (value) => {
    const html = render({ open: true, value, consent: true, touched: true });
    expect(submitButton(html)).not.toMatch(/disabled=""/);
  });

  it("save failure shows the server message and offers retry", () => {
    const html = render({
      open: true,
      value: "9876543210",
      consent: true,
      status: "saveFailed",
      message: "Saved nothing.",
    });
    expect(html).toContain("Saved nothing.");
    expect(submitButton(html)).toContain("Try again");
  });

  it("PDF failure says the details are already saved", () => {
    const html = render({ open: true, value: "9876543210", consent: true, status: "pdfFailed", captureId: "cap-1" });
    expect(html).toContain("Your details are saved, but the PDF couldn&#x27;t be created.");
  });

  it("while saving, everything is disabled", () => {
    const html = render({
      open: true,
      value: "9876543210",
      consent: true,
      status: "saving",
      idempotencyKey: KEY_A,
      run: 1,
    });
    expect(submitButton(html)).toMatch(/disabled=""[^>]*>Saving your details…/);
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*disabled=""/);
  });
});

describe("source safeguards", () => {
  const source = readFileSync(path.resolve("src/app/estimate/DownloadEstimatePdfButton.tsx"), "utf8");

  it("a cancelled save or build never downloads (cancel flag set synchronously on close)", () => {
    const guard = source.indexOf("if (!isCurrent()) return;");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(source.indexOf("link.click()"));
    expect(source).toMatch(/const closeGate = \(\) => \{\s*if \(cancelRef\.current\) cancelRef\.current\.cancelled = true;/);
    expect(source).not.toMatch(/onClick=\{\(\) => dispatch\(\{ type: "close" \}\)\}/);
  });

  it("only posts to /api/estimate-downloads and never logs or stores the contact in the browser", () => {
    const apiCalls = source.match(/["'`]\/api\/[^"'`]+/g) ?? [];
    expect(apiCalls).toEqual(['"/api/estimate-downloads']);
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie|sendBeacon/);
    expect(source).not.toMatch(/console\.\w+\([^)]*(gate\.value|contact)/);
  });
});

describe("footer legal links", () => {
  it("renders no placeholder or unapproved legal links", () => {
    const html = renderToStaticMarkup(createElement(Footer));
    expect(LEGAL_LINKS).toHaveLength(0);
    expect(html).not.toContain('href="#"');
    expect(html).not.toMatch(/Privacy Policy|Terms &amp; Conditions/);
  });
});
