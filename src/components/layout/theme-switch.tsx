"use client";
// Light / dark switch next to the language switch (user, 2026-11-27: one round button). Without a stored choice the
// page follows the system setting; a click stores the opposite of what is shown right now in a cookie, like the
// language, and the root layout puts it on <html> as data-theme.
import { useRouter } from "next/navigation";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { useColorScheme } from "./color-scheme";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** What is shown right now and the switch to the other scheme – shared by the round button and the menu entry. */
function useThemeToggle() {
  const router = useRouter();
  const shown = useColorScheme();
  const next: Theme = shown === "dark" ? "light" : "dark";

  function choose() {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    document.documentElement.dataset.theme = next; // at once; the refresh brings the matching browser bar colour
    router.refresh();
  }

  return { shown, next, choose };
}

export function ThemeSwitch({ toDark, toLight }: { toDark: string; toLight: string }) {
  const { shown, next, choose } = useThemeToggle();
  const label = next === "dark" ? toDark : toLight;

  return (
    <button
      type="button"
      onClick={choose}
      aria-label={label}
      title={label}
      className="grid size-9 flex-none place-items-center rounded-full border border-line text-ink transition-colors duration-150 ease-out hover:bg-mint motion-reduce:transition-none"
    >
      {shown === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}

type EntryProps = { label: string; dark: string; light: string; toDark: string; toLight: string; className?: string };

/** The same switch as one row of the account menu: "Appearance … Dark" – a click changes to the other scheme. */
export function ThemeMenuEntry({ label, dark, light, toDark, toLight, className }: EntryProps) {
  const { shown, next, choose } = useThemeToggle();
  return (
    <button type="button" onClick={choose} className={className}>
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {shown === "dark" ? dark : light}
        {shown === "dark" ? <MoonIcon size={16} /> : <SunIcon size={16} />}
        {/* what a click does, for screen readers (the visible words name the current state) */}
        <span className="sr-only">. {next === "dark" ? toDark : toLight}</span>
      </span>
    </button>
  );
}
