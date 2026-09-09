import type { Metadata } from "next";
import { JetBrains_Mono, Source_Serif_4, Work_Sans } from "next/font/google";
import "./globals.css";

import { SiteHeader } from "@/app/components/site-header";
import { siteConfig } from "@/lib/site-config";

// Self-hosted via next/font (baixadas em build time, servidas pelo nosso
// próprio domínio — sem request em runtime para o CDN do Google). Ver
// CLAUDE.md "Sistema de design" para o porquê dessas três fontes específicas
// terem sido escolhidas.
const sourceSerif4 = Source_Serif_4({
  variable: "--font-source-serif-4",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
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
  title: siteConfig.name,
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
      className={`${sourceSerif4.variable} ${workSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-ink">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
