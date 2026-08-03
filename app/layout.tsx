import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Work_Sans } from "next/font/google";
import "./globals.css";

import { SiteHeader } from "@/app/components/site-header";
import { siteConfig } from "@/lib/site-config";

// Self-hosted via next/font (downloaded at build time, served from our own
// domain — no runtime request to Google's CDN). See CLAUDE.md "Sistema de
// design" for why these three specific fonts were chosen.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description:
    "Marketplace que conecta famílias a cuidadores de confiança para idosos, crianças e pessoas com necessidades especiais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${workSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-ink">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
