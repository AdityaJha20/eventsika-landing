import type { Metadata } from "next";

export const SITE_URL = "https://eventsika.in";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

/** Existing packages film poster, reused as the default social preview image. */
export const DEFAULT_SOCIAL_IMAGE = "/images/eventsika-packages-film-poster.webp";

/**
 * Per-page title, description, canonical and social cards. Next.js merges
 * `openGraph`/`twitter` shallowly, so every page must set them in full or it
 * inherits the homepage's og:title and og:url.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const socialTitle = `${title} | Eventsika`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: "Eventsika",
      locale: "en_IN",
      title: socialTitle,
      description,
      url: `${SITE_URL}${path}`,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
  };
}

/** Escapes `<` so JSON-LD can never close its script tag early. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function breadcrumbJsonLd(name: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
    ],
  };
}
