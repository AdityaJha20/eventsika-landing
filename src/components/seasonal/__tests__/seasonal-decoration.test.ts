import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Navbar from "../../Navbar";
import SeasonalDecoration, { ACTIVE_SEASONAL_THEME, type SeasonalTheme } from "../SeasonalDecoration";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const render = (theme?: SeasonalTheme) =>
  renderToStaticMarkup(createElement(SeasonalDecoration, theme ? { theme } : {}));
const source = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8");
const cssRule = (css: string, selector: string) =>
  css.match(new RegExp(`${selector.replace(".", "\\.")} \\{([^}]*)\\}`))?.[1] ?? "";

describe("seasonal theme switch", () => {
  it("ships with Christmas as the active theme, used by default", () => {
    expect(ACTIVE_SEASONAL_THEME).toBe("christmas");
    expect(render()).toBe(render("christmas"));
  });

  it('renders nothing at all for "none"', () => {
    expect(render("none")).toBe("");
  });

  it("renders the Christmas garland as a hidden, decorative overlay", () => {
    const html = render("christmas");
    expect(html).toMatch(/^<div[^>]*aria-hidden="true"/);
    expect(html).toContain('href="#xmas-pine-');
    expect(html).not.toMatch(/<(a|button|input)\b|tabindex=/);
  });

  it("keeps the Diwali decoration available and distinct", () => {
    const html = render("diwali");
    expect(html).not.toBe("");
    expect(html).not.toBe(render("christmas"));
  });

  it("holds no state between renders, so switching themes leaves nothing behind", () => {
    render("christmas");
    expect(render("none")).toBe("");
    expect(render("diwali")).not.toContain("xmas-pine");
  });

  it("renders identical markup every time, so server and client hydration match", () => {
    expect(render("christmas")).toBe(render("christmas"));
  });

  it("defines each SVG id once, with a Christmas-specific prefix", () => {
    const ids = [...render("christmas").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("xmas-"))).toBe(true);
  });
});

describe("navbar with the seasonal decoration", () => {
  const html = renderToStaticMarkup(createElement(Navbar));
  const hrefs = [...html.matchAll(/<a[^>]*href="([^"]+)"/g)].map((m) => m[1]);

  it("keeps every navigation link and CTA destination", () => {
    expect(hrefs).toEqual([
      "/",
      "/#how-it-works", "/#events", "/services", "/packages", "/for-vendors", "/#contact",
      "/diwali-consultation", "/packages",
      "/diwali-consultation",
      "/#how-it-works", "/#events", "/services", "/packages", "/for-vendors", "/#contact",
      "/packages",
    ]);
    expect(html).toContain(">Book a Consultation<");
    expect(html).toContain(">Customize Your Celebration<");
  });

  it("mounts the decoration before the navigation content it sits behind", () => {
    const decoration = html.indexOf('aria-hidden="true"');
    expect(decoration).toBeGreaterThan(-1);
    expect(decoration).toBeLessThan(html.indexOf("<a"));
  });

  it("keeps the mobile menu toggle wired to the mobile menu", () => {
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="mobile-menu"/);
    expect(html).toContain('id="mobile-menu"');
  });
});

describe("Christmas decoration styling safeguards", () => {
  const css = source("christmas/ChristmasNavbarDecoration.module.css");

  it("never intercepts clicks, sits behind navbar content and takes no layout space", () => {
    const overlay = cssRule(css, ".overlay");
    expect(overlay).toMatch(/pointer-events:\s*none/);
    expect(overlay).toMatch(/z-index:\s*-1/);
    expect(overlay).toMatch(/position:\s*absolute/);
    expect(overlay).toMatch(/inset:\s*0/);
    expect(overlay).toMatch(/overflow:\s*hidden/);
  });

  it("stops all motion and snowfall when reduced motion is requested", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.light,\s*\.ornament\s*\{\s*animation:\s*none/);
    expect(reduced).toMatch(/\.snow\s*\{\s*display:\s*none/);
  });

  it("keeps Christmas code out of the core navbar", () => {
    const navbarCss = source("../Navbar.module.css");
    const navbarTsx = source("../Navbar.tsx");
    expect(navbarCss).not.toMatch(/christmas|garland|snow|ornament/i);
    expect(navbarTsx).not.toMatch(/christmas/i);
    expect(navbarTsx.match(/<SeasonalDecoration \/>/g)).toHaveLength(1); // single integration point
  });
});
