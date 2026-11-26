import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import {
  DEFAULT_SOCIAL_IMAGE,
  ORGANIZATION_ID,
  SITE_URL,
  WEBSITE_ID,
  serializeJsonLd,
} from "@/lib/seo";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const SITE_DESCRIPTION =
  "Thoughtfully planned Indian celebrations, beautifully delivered at home. Curated decor, authentic catering, photography, and seamless event management.";

// Site-wide defaults. Each indexable page sets its own canonical and social
// cards via pageMetadata(); no canonical here so 404s and noindex pages don't
// point at the homepage.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Eventsika | Celebrate Seamlessly",
    template: "%s | Eventsika",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Eventsika",
    locale: "en_IN",
    title: "Eventsika | Celebrate Seamlessly",
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eventsika | Celebrate Seamlessly",
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
};

// The one Organization entity; other pages reference it by @id.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: "Eventsika",
      url: SITE_URL,
      logo: `${SITE_URL}/images/eventsika-official-logo.png`,
      telephone: "+917876666056",
      email: "care@eventsika.in",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: "+917876666056",
        email: "care@eventsika.in",
      },
      sameAs: [
        "https://www.instagram.com/eventsika.in",
        "https://www.facebook.com/eventsika",
        "https://www.linkedin.com/company/eventsika/",
        "https://x.com/Eventsika_",
        "https://www.pinterest.com/eventsika/",
      ],
      areaServed: {
        "@type": "Country",
        name: "India",
      },
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: "Eventsika",
      url: SITE_URL,
      inLanguage: "en-IN",
      publisher: { "@id": ORGANIZATION_ID },
      description: SITE_DESCRIPTION,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" data-scroll-behavior="smooth">
      <body className={`${playfair.variable} ${inter.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(jsonLd),
          }}
        />
        {children}
      </body>
    </html>
  );
}