import type { Metadata, Viewport } from "next";
import { DM_Sans, Righteous } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SITE_CONFIG, absoluteUrl, getBaseUrl } from "@/lib/site-config";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dm-sans",
});
const righteous = Righteous({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-righteous",
});

// Dynamic base URL derived from environment variables (APP_URL, NEXT_PUBLIC_APP_URL, VERCEL_URL, etc.)
const siteBaseUrl = getBaseUrl();
const metadataBase = new URL(siteBaseUrl);
const pageTitle = `${SITE_CONFIG.name} | ${SITE_CONFIG.tagline}`;

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: pageTitle,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: SITE_CONFIG.description,
  applicationName: SITE_CONFIG.name,
  keywords: [...SITE_CONFIG.keywords],
  authors: [{ name: SITE_CONFIG.author.name, url: siteBaseUrl }],
  creator: SITE_CONFIG.name,
  publisher: SITE_CONFIG.name,
  category: "business",
  classification: "Business & Retail POS Software",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: SITE_CONFIG.name,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    url: siteBaseUrl,
    siteName: SITE_CONFIG.name,
    title: pageTitle,
    description: SITE_CONFIG.description,
    locale: SITE_CONFIG.locale,
    images: [
      {
        url: SITE_CONFIG.ogImage.url,
        secureUrl: absoluteUrl(SITE_CONFIG.ogImage.url),
        width: SITE_CONFIG.ogImage.width,
        height: SITE_CONFIG.ogImage.height,
        type: SITE_CONFIG.ogImage.type,
        alt: SITE_CONFIG.ogImage.alt,
      },
    ],
  },
  twitter: {
    card: SITE_CONFIG.twitter.card,
    site: SITE_CONFIG.twitter.site,
    creator: SITE_CONFIG.twitter.creator,
    title: pageTitle,
    description: SITE_CONFIG.description,
    images: [
      {
        url: absoluteUrl(SITE_CONFIG.ogImage.url),
        width: SITE_CONFIG.ogImage.width,
        height: SITE_CONFIG.ogImage.height,
        alt: `${SITE_CONFIG.name} — Preview Card`,
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SITE_CONFIG.themeColor.light },
    { media: "(prefers-color-scheme: dark)", color: SITE_CONFIG.themeColor.dark },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: SITE_CONFIG.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "All modern web browsers (Cloud / Self-hosted)",
        description: SITE_CONFIG.description,
        url: siteBaseUrl,
        image: absoluteUrl(SITE_CONFIG.ogImage.url),
        screenshot: absoluteUrl(SITE_CONFIG.ogImage.url),
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: [
          "Fast POS billing & barcode scanning",
          "Real-time stock alerts & FIFO / Weighted Average inventory",
          "Expense tracking & profit reports",
          "Multi-user roles and permission management",
          "1-click database backup and restore",
        ],
      },
      {
        "@type": "WebSite",
        name: SITE_CONFIG.name,
        url: siteBaseUrl,
        description: SITE_CONFIG.description,
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning className={`h-full antialiased ${dmSans.variable} ${righteous.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</ThemeProvider>
      </body>
    </html>
  );
}
