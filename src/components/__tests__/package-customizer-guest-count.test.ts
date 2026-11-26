import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PackageCustomizer, { type PackageCustomizerProps } from "@/components/PackageCustomizer";
import {
  DEFAULT_PACKAGE_ID,
  MAX_GUEST_COUNT,
  MIN_GUEST_COUNT,
  PACKAGES_CONFIG,
  formatCurrency,
  parseGuestCountInput,
} from "@/lib/packages-config";

const premiumRate = PACKAGES_CONFIG.find((p) => p.id === DEFAULT_PACKAGE_ID)!.pricePerPerson;

function render(initialGuestInput: string): string {
  return renderToStaticMarkup(createElement<PackageCustomizerProps>(PackageCustomizer, { initialGuestInput }));
}

function guestInputTag(html: string): string {
  const match = html.match(/<input type="number"[^>]*>/);
  if (!match) throw new Error("guest input not rendered");
  return match[0];
}

function expectBlocked(html: string) {
  const input = guestInputTag(html);
  expect(input).toContain('aria-invalid="true"');
  const describedBy = input.match(/aria-describedby="([^"]+)"/)?.[1];
  expect(describedBy).toBeTruthy();
  expect(html).toContain(`id="${describedBy}"`);
  expect(html).toContain('role="alert"');
  // No estimate figure and no link to the estimate page.
  expect(html).not.toContain("/estimate?");
  expect(html).not.toMatch(/per person × \d+ guests/);
  expect(html).toContain("Enter a valid guest count to see your estimate.");
  expect(html).toMatch(/<button type="button" disabled=""[^>]*>View My Indicative Estimate/);
}

function expectEstimate(html: string, guests: number) {
  const input = guestInputTag(html);
  expect(input).not.toContain("aria-invalid");
  expect(input).not.toContain("aria-describedby");
  expect(html).not.toContain('role="alert"');
  expect(html).toContain(formatCurrency(guests * premiumRate));
  expect(html).toContain(`× ${guests} guests`);
  expect(html).toContain(`/estimate?package=${DEFAULT_PACKAGE_ID}&amp;packageGuests=${guests}&amp;`);
}

describe("parseGuestCountInput", () => {
  it.each([
    ["", "Enter the number of guests."],
    ["   ", "Enter the number of guests."],
    ["abc", "Enter a whole number of guests."],
    ["12.5", "Enter a whole number of guests."],
    ["1e3", "Enter a whole number of guests."],
    ["-5", "Enter a whole number of guests."],
    [String(MIN_GUEST_COUNT - 1), `Online estimates start at ${MIN_GUEST_COUNT} guests.`],
  ])("rejects %j", (raw, error) => {
    expect(parseGuestCountInput(raw)).toEqual({ ok: false, error });
  });

  it("rejects above the technical max without publishing the number", () => {
    const result = parseGuestCountInput(String(MAX_GUEST_COUNT + 1));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).not.toContain(String(MAX_GUEST_COUNT));
  });

  it("accepts the limits", () => {
    expect(parseGuestCountInput(String(MIN_GUEST_COUNT))).toEqual({ ok: true, guestCount: MIN_GUEST_COUNT });
    expect(parseGuestCountInput(String(MAX_GUEST_COUNT))).toEqual({ ok: true, guestCount: MAX_GUEST_COUNT });
  });
});

describe("PackageCustomizer guest count (rendered)", () => {
  it("below minimum (9): error, no stale 25-guest estimate, proceeding blocked", () => {
    const html = render("9");
    expectBlocked(html);
    expect(html).toContain("Online estimates start at 10 guests.");
    // The default 25-guest total must not linger on screen.
    expect(html).not.toContain(formatCurrency(25 * premiumRate));
    expect(guestInputTag(html)).toContain('value="9"');
  });

  it("at minimum (10): shows the 10-guest estimate", () => {
    expectEstimate(render("10"), 10);
  });

  it("valid (25 default): shows the 25-guest estimate", () => {
    expectEstimate(render("25"), 25);
    expectEstimate(renderToStaticMarkup(createElement(PackageCustomizer)), 25);
  });

  it("above max: error without stating the technical max", () => {
    const html = render(String(MAX_GUEST_COUNT + 1));
    expectBlocked(html);
    expect(html).toContain("please contact us for a custom quote");
  });

  it.each(["", "abc", "12.5"])("empty/malformed %j: blocked", (raw) => {
    expectBlocked(render(raw));
  });

  it("recovers immediately on a valid value", () => {
    expectBlocked(render("9"));
    expectEstimate(render("11"), 11);
  });
});
