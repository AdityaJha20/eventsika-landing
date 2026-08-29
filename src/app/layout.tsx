import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://eventsika.in"),
  title: {
    default: "Eventsika | Celebrate Seamlessly",
    template: "%s | Eventsika",
  },
  description:
    "Thoughtfully planned Indian celebrations, beautifully delivered at home. Curated decor, authentic catering, photography, and seamless event management.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Eventsika",
    locale: "en_IN",
    title: "Eventsika | Celebrate Seamlessly",
    description:
      "Thoughtfully planned Indian celebrations, beautifully delivered at home. Curated decor, authentic catering, photography, and seamless event management.",
    url: "https://eventsika.in",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eventsika | Celebrate Seamlessly",
    description:
      "Thoughtfully planned Indian celebrations, beautifully delivered at home. Curated decor, authentic catering, photography, and seamless event management.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Eventsika",
      url: "https://eventsika.in",
      logo: "https://eventsika.in/images/eventsika-official-logo.png",
      telephone: "+917876666056",
      email: "care@eventsika.in",
      areaServed: {
        "@type": "Country",
        name: "India",
      },
      description:
        "Thoughtfully planned Indian celebrations, beautifully delivered at home. Curated decor, authentic catering, photography, and seamless event management.",
    },
    {
      "@type": "WebSite",
      name: "Eventsika",
      url: "https://eventsika.in",
      description:
        "Thoughtfully planned Indian celebrations, beautifully delivered at home. Curated decor, authentic catering, photography, and seamless event management.",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${playfair.variable} ${inter.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd),
          }}
        />
        {children}
      </body>
    </html>
  );
}