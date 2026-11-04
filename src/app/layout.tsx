import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { APP_META } from "@/lib/constants/app";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dm-sans",
});


// Shared images need absolute URLs; the deployed shop domain is only known at deploy time.
const metadataBase = new URL(process.env.APP_URL ?? "http://localhost:3000");

const pageTitle = `${APP_META.name} | Grocery shop management`;

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: pageTitle,
    template: `%s | ${APP_META.name}`,
  },
  description: APP_META.description,
  applicationName: APP_META.name,
  icons: {
    icon: "/favicon.png",
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: APP_META.name,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: APP_META.name,
    title: pageTitle,
    description: APP_META.description,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1792,
        height: 1024,
        alt: `${APP_META.name} — ${APP_META.description}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: APP_META.description,
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#101918" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`h-full antialiased ${dmSans.variable}`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</ThemeProvider>
      </body>
    </html>
  );
}
