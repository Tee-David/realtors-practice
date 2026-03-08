import type { Metadata } from "next";
import { Space_Grotesk, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";

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
    apple: "/favicon.png",
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
          {children}
        </Providers>
        <Toaster richColors position="top-right" duration={5000} />
      </body>
    </html>
  );
}
