import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  BASE_PACKAGE_INCLUSION,
  calculatePackageEstimate,
  estimateLineItems,
  formatCurrency,
  formatPerPersonRate,
  getPackageTier,
} from "@/lib/packages-config";
import type { PackageQuoteSelection } from "@/lib/package-quote";

export const ESTIMATE_PAGE_DISCLAIMER =
  "This is an indicative estimate, not an invoice or a request for payment. Each package includes decor only; optional services are charged per guest only when selected. Supplier availability, the final proposal and tax treatment require confirmation with Eventsika.";

export const ESTIMATE_CONTACT_LINE = "Eventsika · care@eventsika.in · eventsika.in";

/** Long-form date in Indian English, in India Standard Time. */
export function formatEstimateDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export interface EstimatePdfModel {
  packageName: string;
  guests: string;
  date: string;
  includes: string;
  rows: { item: string; note?: string; rate: string; guests: string; subtotal: string }[];
  hasServices: boolean;
  totals: { label: string; value: string }[];
  grandTotal: { label: string; value: string };
  disclaimer: string;
  contact: string;
}

/** Every figure in the PDF, formatted by the same helpers the on-screen estimate uses. */
export function buildEstimatePdfModel(selection: PackageQuoteSelection, createdAt: Date): EstimatePdfModel {
  const estimate = calculatePackageEstimate(selection.guestCount, selection.tierId, selection.serviceIds);
  const tier = getPackageTier(estimate.tierId);
  const lines = estimateLineItems(estimate);
  const hasServices = lines.length > 1;
  return {
    packageName: tier.name,
    guests: String(estimate.guestCount),
    date: formatEstimateDate(createdAt),
    includes: BASE_PACKAGE_INCLUSION,
    rows: lines.map((line) => ({
      item: line.label,
      note: line.id === "decor" ? "Includes decor only" : undefined,
      rate: formatPerPersonRate(line.ratePerPerson),
      guests: String(line.quantity),
      subtotal: formatCurrency(line.subtotal),
    })),
    hasServices,
    totals: [
      { label: "Decor package subtotal", value: formatCurrency(estimate.packageSubtotal) },
      {
        label: "Selected services subtotal",
        value: hasServices ? formatCurrency(estimate.servicesSubtotal) : "None selected",
      },
      { label: "Total per person", value: formatPerPersonRate(estimate.perPersonTotal) },
    ],
    grandTotal: { label: "Indicative grand total", value: formatCurrency(estimate.total) },
    disclaimer: ESTIMATE_PAGE_DISCLAIMER,
    contact: ESTIMATE_CONTACT_LINE,
  };
}

export function estimatePdfFilename(selection: PackageQuoteSelection): string {
  return `Eventsika-Estimate-${getPackageTier(selection.tierId).name}-${selection.guestCount}-Guests.pdf`;
}

export interface EstimatePdfAssets {
  bodyFont: ArrayBuffer | Uint8Array;
  displayFont: ArrayBuffer | Uint8Array;
  logoPng: ArrayBuffer | Uint8Array;
}

// Eventsika palette (globals.css)
const CREAM = rgb(0xff / 255, 0xfa / 255, 0xf4 / 255);
const CREAM_DARK = rgb(0xf8 / 255, 0xf3 / 255, 0xec / 255);
const INK = rgb(0x2b / 255, 0x21 / 255, 0x1d / 255);
const MUTED = rgb(0x5c / 255, 0x4d / 255, 0x44 / 255);
const GOLD = rgb(0x86 / 255, 0x69 / 255, 0x3f / 255);
const GOLD_LINE = rgb(0xb9 / 255, 0x9a / 255, 0x67 / 255);
const BORDER = rgb(0xdf / 255, 0xd2 / 255, 0xc3 / 255);
const CRANBERRY = rgb(0x7f / 255, 0x10 / 255, 0x10 / 255);

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const FOOTER_SPACE = 56;

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Builds the A4 estimate PDF. Runs in the browser (download button) and in Node (tests). */
export async function buildEstimatePdf(model: EstimatePdfModel, assets: EstimatePdfAssets): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Eventsika Indicative Event Estimate — ${model.packageName}, ${model.guests} guests`);
  doc.setAuthor("Eventsika");
  doc.setCreator("eventsika.in");
  // Not subset: pdf-lib's subsetter drops glyphs from the variable Inter font (verified visually).
  const body = await doc.embedFont(assets.bodyFont, { subset: false });
  const display = await doc.embedFont(assets.displayFont, { subset: true });
  const logo = await doc.embedPng(assets.logoPng);

  const [W, H] = A4;
  const contentW = W - MARGIN * 2;
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const text = (s: string, x: number, yy: number, size: number, font = body, color = INK) =>
    page.drawText(s, { x, y: yy, size, font, color });
  const rightText = (s: string, xRight: number, yy: number, size: number, font = body, color = INK) =>
    text(s, xRight - font.widthOfTextAtSize(s, size), yy, size, font, color);

  const newPage = () => {
    page = doc.addPage(A4);
    pages.push(page);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: CREAM });
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: CRANBERRY });
    y = H - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + FOOTER_SPACE) {
      newPage();
      return true;
    }
    return false;
  };

  // ---- Header
  newPage();
  const logoW = 150;
  const logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, { x: MARGIN, y: y - logoH, width: logoW, height: logoH });
  rightText("CELEBRATION PLANNING", W - MARGIN, y - 12, 8.5, body, GOLD);
  rightText("Indicative Event Estimate", W - MARGIN, y - 38, 22, display, INK);
  y -= Math.max(logoH, 48) + 18;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 1.2, color: GOLD_LINE });
  y -= 26;

  // ---- Meta grid (4 columns)
  const meta: [string, string][] = [
    ["PACKAGE", model.packageName],
    ["GUESTS", model.guests],
    ["ESTIMATE DATE", model.date],
    ["PACKAGE INCLUDES", model.includes],
  ];
  const colW = contentW / 4;
  meta.forEach(([label, value], i) => {
    const x = MARGIN + i * colW;
    text(label, x, y, 8, body, GOLD);
    text(value, x, y - 17, 12, body, INK);
  });
  y -= 46;

  // ---- Itemised table
  text("Itemised Breakdown", MARGIN, y, 15, display, INK);
  y -= 16;
  const cols = [
    { label: "Item", x: MARGIN + 10, align: "left" as const },
    { label: "Rate per person", x: MARGIN + contentW * 0.62, align: "right" as const },
    { label: "Guests", x: MARGIN + contentW * 0.76, align: "right" as const },
    { label: "Subtotal", x: MARGIN + contentW - 10, align: "right" as const },
  ];
  const itemMaxW = contentW * 0.62 - 120;
  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 24, width: contentW, height: 24, color: CRANBERRY });
    for (const c of cols) {
      if (c.align === "left") text(c.label, c.x, y - 16, 9, body, CREAM);
      else rightText(c.label, c.x, y - 16, 9, body, CREAM);
    }
    y -= 24;
  };
  drawTableHeader();
  model.rows.forEach((row, i) => {
    const itemLines = wrap(row.item, body, 10.5, itemMaxW);
    const rowH = 14 + itemLines.length * 14 + (row.note ? 13 : 0);
    if (ensure(rowH)) drawTableHeader();
    if (i % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - rowH, width: contentW, height: rowH, color: CREAM_DARK });
    let ty = y - 18;
    itemLines.forEach((l) => {
      text(l, cols[0].x, ty, 10.5, body, INK);
      ty -= 14;
    });
    if (row.note) text(row.note, cols[0].x, ty + 1, 8.5, body, GOLD);
    rightText(row.rate, cols[1].x, y - 18, 10.5, body, INK);
    rightText(row.guests, cols[2].x, y - 18, 10.5, body, INK);
    rightText(row.subtotal, cols[3].x, y - 18, 10.5, body, INK);
    y -= rowH;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: W - MARGIN, y }, thickness: 0.6, color: BORDER });
  });
  if (!model.hasServices) {
    ensure(24);
    y -= 18;
    text("No optional services selected", MARGIN + 10, y, 9.5, body, MUTED);
  }
  y -= 26;

  // ---- Totals
  const boxW = 270;
  const boxX = W - MARGIN - boxW;
  const totalsH = model.totals.length * 22 + 44;
  ensure(totalsH + 10);
  page.drawRectangle({ x: boxX, y: y - totalsH, width: boxW, height: totalsH, color: CREAM, borderColor: BORDER, borderWidth: 0.8 });
  let ry = y - 20;
  for (const t of model.totals) {
    text(t.label, boxX + 14, ry, 10, body, MUTED);
    rightText(t.value, boxX + boxW - 14, ry, 10, body, INK);
    ry -= 22;
  }
  page.drawRectangle({ x: boxX, y: y - totalsH, width: boxW, height: 36, color: CRANBERRY });
  text(model.grandTotal.label, boxX + 14, y - totalsH + 13, 10.5, body, CREAM);
  rightText(model.grandTotal.value, boxX + boxW - 14, y - totalsH + 11, 15, body, CREAM);
  y -= totalsH + 28;

  // ---- Disclaimer
  const discLines = wrap(model.disclaimer, body, 9, contentW);
  ensure(discLines.length * 13 + 6);
  page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: MARGIN + 60, y: y + 8 }, thickness: 1, color: GOLD_LINE });
  for (const l of discLines) {
    y -= 13;
    text(l, MARGIN, y, 9, body, MUTED);
  }

  // ---- Footer on every page
  pages.forEach((p, i) => {
    page = p;
    page.drawLine({ start: { x: MARGIN, y: MARGIN + 18 }, end: { x: W - MARGIN, y: MARGIN + 18 }, thickness: 0.6, color: BORDER });
    text(model.contact, MARGIN, MARGIN, 9, body, GOLD);
    rightText(`Page ${i + 1} of ${pages.length}`, W - MARGIN, MARGIN, 8.5, body, MUTED);
  });

  return doc.save();
}
