import type { Metadata } from "next";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { APP_META } from "@/lib/constants/app";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_META.name} | Grocery shop management`,
  description: APP_META.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</ThemeProvider>
      </body>
    </html>
  );
}
