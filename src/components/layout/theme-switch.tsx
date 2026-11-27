"use client";
// Light / dark switch next to the language switch (user, 2026-11-27: one round button). Without a stored choice the
// page follows the system setting; a click stores the opposite of what is shown right now in a cookie, like the
// language, and the root layout puts it on <html> as data-theme.
import { useRouter } from "next/navigation";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { useColorScheme } from "./color-scheme";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function ThemeSwitch({ toDark, toLight }: { toDark: string; toLight: string }) {
  const router = useRouter();
  const shown = useColorScheme();
  const next: Theme = shown === "dark" ? "light" : "dark";
  const label = next === "dark" ? toDark : toLight;

  function choose() {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    document.documentElement.dataset.theme = next; // at once; the refresh brings the matching browser bar colour
    router.refresh();
  }

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
