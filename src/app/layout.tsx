import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { getLocale } from "@/i18n/locale";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "KreiswertS",
  description: "Der B2B-Marktplatz für Kreislaufmaterialien – Plattform-Prototyp aus Kamp-Lintfort",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={inter.variable}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
