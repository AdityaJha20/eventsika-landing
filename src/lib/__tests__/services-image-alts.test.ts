import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// SERVICES_DATA is module-private to the page (Next pages may not export extra
// names), so read the image/alt pairs straight from the source.
const source = readFileSync(path.resolve("src/app/services/page.tsx"), "utf8");
const altFor = (image: string): string => {
  const match = source.match(new RegExp(`image: "${image}",\\s*alt: "([^"]*)"`));
  if (!match) throw new Error(`no alt for ${image}`);
  return match[1];
};

describe("/services image alt text (EVT-001/002)", () => {
  it("Rituals & Blessings describes the puja, not photography", () => {
    const alt = altFor("/images/service-rituals-blessings.png");
    expect(alt).toMatch(/puja|shrine/i);
    expect(alt).not.toMatch(/photo|film|cinematic/i);
  });

  it("Photography & Films describes photography, not an event coordinator", () => {
    const alt = altFor("/images/service-photography-films.png");
    expect(alt).toMatch(/photograph/i);
    expect(alt).not.toMatch(/coordinator/i);
  });
});
