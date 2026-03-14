import type { Metadata } from "next";
import { Space_Grotesk, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { ClientOnlyWidgets } from "@/components/ui/client-only-widgets";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Realtors' Practice",
  description:
    "Nigerian property intelligence platform. Scrape, validate, enrich, and discover real estate listings.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/logo-icon-blue.png",
  },
  manifest: "/manifest.json",
  themeColor: "#0001FC",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Realtors' Practice",
  },
  other: {
    "apple-touch-icon": "/logo-icon-blue.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${outfit.variable} font-body antialiased min-h-screen`}
        style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
        suppressHydrationWarning
      >
        <Providers>
          <ClientOnlyWidgets />
          {children}
        </Providers>
        <Toaster richColors position="top-right" duration={5000} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
