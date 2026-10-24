/**
 * Schema.org structured data for the /packages pricing page, generated
 * exclusively from the public pricing catalog in `packages-config.ts`.
 */

import {
  OPTIONAL_SERVICES_CONFIG,
  PACKAGES_CONFIG,
  BASE_PACKAGE_INCLUSION,
} from "./packages-config";

const SITE_URL = "https://eventsika.in";

const provider = {
  "@type": "Organization",
  name: "Eventsika",
  url: SITE_URL,
};

function perGuestPriceSpecification(price: number) {
  return {
    "@type": "UnitPriceSpecification",
    price,
    priceCurrency: "INR",
    referenceQuantity: {
      "@type": "QuantitativeValue",
      value: 1,
      unitText: "guest",
    },
  };
}

export function buildPackagesOfferCatalogJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Eventsika Decor Packages & Optional Services",
    description:
      "Per-guest decor packages with optional per-guest services. Rates are indicative; supplier availability, the final quote and tax treatment are confirmed separately.",
    url: `${SITE_URL}/packages`,
    itemListElement: [
      ...PACKAGES_CONFIG.map((pkg) => ({
        "@type": "Offer",
        name: `${pkg.name} Decor Package`,
        description: `${pkg.name} package. Includes: ${BASE_PACKAGE_INCLUSION.toLowerCase()}. Optional services are charged per guest only when selected.`,
        url: `${SITE_URL}/packages#customizer`,
        priceSpecification: perGuestPriceSpecification(pkg.pricePerPerson),
        itemOffered: {
          "@type": "Service",
          name: `${pkg.name} Decor Package`,
          serviceType: "Event decor",
          provider,
        },
      })),
      {
        "@type": "OfferCatalog",
        name: "Optional per-guest services",
        itemListElement: OPTIONAL_SERVICES_CONFIG.map((service) => ({
          "@type": "OfferCatalog",
          name: service.name,
          itemListElement: PACKAGES_CONFIG.map((pkg) => ({
            "@type": "Offer",
            name: `${service.name} (${pkg.name})`,
            priceSpecification: perGuestPriceSpecification(
              service.ratesPerPerson[pkg.id],
            ),
            itemOffered: {
              "@type": "Service",
              name: service.name,
              provider,
            },
          })),
        })),
      },
    ],
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
