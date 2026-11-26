import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// Description follows the language cookie, like the page texts.
export async function generateMetadata(): Promise<Metadata> {
  const t = messages[await getLocale()];
  return { title: t.common.brand, description: t.common.description };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={inter.variable}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
