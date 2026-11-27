// Chosen colour scheme on the server: cookie from the theme switch, otherwise null (= follow the system setting).
import "server-only";
import { cookies } from "next/headers";
import { THEME_COOKIE, isTheme, type Theme } from "./theme";

export async function getTheme(): Promise<Theme | null> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : null;
}
