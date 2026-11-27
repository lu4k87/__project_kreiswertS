"use client";
// The colour scheme the page shows right now: data-theme on <html> (theme switch), otherwise the system setting.
// The theme switch needs it to show the right icon while no choice is stored (system setting).
import { useSyncExternalStore } from "react";
import type { Theme } from "@/lib/theme";

const QUERY = "(prefers-color-scheme: dark)";

function current(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia(QUERY).matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

export function useColorScheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => "light");
}
