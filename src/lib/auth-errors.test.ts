import { describe, expect, it } from "vitest";
import { authErrorText } from "./auth-errors";
import { REGISTRATION_ERROR } from "@/server/validation/registration";

describe("authErrorText", () => {
  it("übersetzt bekannte Codes von Better Auth", () => {
    expect(authErrorText({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 })).toMatch(/schon registriert/);
    expect(authErrorText({ code: "PASSWORD_TOO_SHORT", status: 400 })).toMatch(/mindestens 8 Zeichen/);
    expect(authErrorText({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe("E-Mail oder Passwort falsch.");
  });

  it("meldet zu viele Versuche am Status 429", () => {
    expect(authErrorText({ status: 429 })).toMatch(/Zu viele Versuche/);
  });

  it("fällt bei Unbekanntem auf einen allgemeinen Satz zurück, ohne Technik zu zeigen", () => {
    expect(authErrorText({ code: "SOMETHING_NEW", status: 500, message: "db down" })).toBe(
      "Das hat nicht geklappt. Bitte später erneut versuchen.",
    );
    expect(authErrorText(null)).toMatch(/nicht geklappt/);
  });

  it("liefert dieselben Fälle auf Englisch", () => {
    expect(authErrorText({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, "en")).toBe("Email or password is incorrect.");
    expect(authErrorText({ status: 429 }, "en")).toMatch(/Too many attempts/);
    expect(authErrorText({ code: "SOMETHING_NEW", status: 500 }, "en")).toBe("That did not work. Please try again later.");
  });

  it("hat für jeden Registrierungs- und Benutzernamen-Code einen eigenen Satz in DE und EN", () => {
    const codes = [...Object.values(REGISTRATION_ERROR), "USERNAME_IS_ALREADY_TAKEN", "INVALID_USERNAME_OR_PASSWORD"];
    for (const code of codes) {
      for (const locale of ["de", "en"] as const) {
        expect(authErrorText({ code }, locale)).not.toBe(authErrorText(null, locale));
      }
    }
  });
});
