import { describe, expect, it } from "vitest";
import {
  buildPackagesOfferCatalogJsonLd,
  serializeJsonLd,
} from "../packages-structured-data";
import { OPTIONAL_SERVICES_CONFIG, PACKAGES_CONFIG } from "../packages-config";

describe("Packages structured data", () => {
  const jsonLd = buildPackagesOfferCatalogJsonLd();

  it("publishes one per-guest offer for each decor package tier", () => {
    const tierOffers = jsonLd.itemListElement.filter(
      (item) => item["@type"] === "Offer",
    ) as Array<{ name: string; priceSpecification: Record<string, unknown> }>;

    expect(tierOffers.map((offer) => offer.name)).toEqual([
      "Essential Decor Package",
      "Premium Decor Package",
      "Luxury Decor Package",
    ]);
    expect(tierOffers.map((offer) => offer.priceSpecification)).toEqual(
      PACKAGES_CONFIG.map((pkg) => ({
        "@type": "UnitPriceSpecification",
        price: pkg.pricePerPerson,
        priceCurrency: "INR",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: "guest" },
      })),
    );
  });

  it("publishes every optional service at its approved per-tier rate", () => {
    const serviceCatalog = jsonLd.itemListElement.find(
      (item) => item["@type"] === "OfferCatalog",
    ) as { itemListElement: Array<{ name: string; itemListElement: Array<{ priceSpecification: { price: number } }> }> };

    expect(serviceCatalog.itemListElement.map((entry) => entry.name)).toEqual(
      OPTIONAL_SERVICES_CONFIG.map((service) => service.name),
    );
    serviceCatalog.itemListElement.forEach((entry, index) => {
      const service = OPTIONAL_SERVICES_CONFIG[index];
      expect(entry.itemListElement.map((offer) => offer.priceSpecification.price)).toEqual(
        PACKAGES_CONFIG.map((pkg) => service.ratesPerPerson[pkg.id]),
      );
    });
  });

  it("makes no tax claim and contains no internal commercial fields", () => {
    const serialized = JSON.stringify(jsonLd).toLowerCase();
    expect(serialized).not.toContain("valueaddedtaxincluded");
    for (const forbidden of ["cost", "margin", "markup", "profit"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("escapes HTML-significant characters when serialised into a script tag", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("<");
  });
});
