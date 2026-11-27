import type { Metadata, Viewport } from "next";
import { Inter, Syne } from "next/font/google";
import type { ReactNode } from "react";
import { getLocale } from "@/i18n/locale";
import { messages } from "@/i18n/messages";
import { SURFACE } from "@/lib/theme";
import { getTheme } from "@/lib/theme-cookie";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Wordmark only (logo choice 2026-11-27): one weight keeps the download small.
const syne = Syne({ subsets: ["latin"], weight: "800", variable: "--font-syne", display: "swap" });

// Description follows the language cookie, like the page texts.
export async function generateMetadata(): Promise<Metadata> {
  const t = messages[await getLocale()];
  return { title: t.common.brand, description: t.common.description };
}

// Browser bar and native controls follow the chosen scheme, without a choice the system setting.
export async function generateViewport(): Promise<Viewport> {
  const theme = await getTheme();
  if (theme) return { colorScheme: theme, themeColor: SURFACE[theme] };
  return {
    colorScheme: "light dark",
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: SURFACE.light },
      { media: "(prefers-color-scheme: dark)", color: SURFACE.dark },
    ],
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    <html lang={locale} data-theme={theme ?? undefined} className={`${inter.variable} ${syne.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
