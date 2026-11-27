// Colour scheme: light, dark, or – without a cookie – the system setting (prefers-color-scheme).
// The switch next to the language switch stores the choice in this cookie; the root layout puts it on <html>
// as data-theme, and the tokens in globals.css follow it (light-dark()).

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
/** Cookie set by the theme switch (read on the server in src/lib/theme-cookie.ts). */
export const THEME_COOKIE = "theme";

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

/** Page background per scheme = --color-surface in globals.css (browser bar colour, <meta name="theme-color">). */
export const SURFACE: Record<Theme, string> = { light: "#ffffff", dark: "#141414" };
