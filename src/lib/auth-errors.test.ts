import { describe, expect, it } from "vitest";
import { authErrorText } from "./auth-errors";
import { REGISTRATION_ERROR } from "@/server/validation/registration";

describe("authErrorText", () => {
  it("translates known Better Auth codes", () => {
    expect(authErrorText({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 })).toMatch(/schon registriert/);
    expect(authErrorText({ code: "PASSWORD_TOO_SHORT", status: 400 })).toMatch(/mindestens 8 Zeichen/);
    expect(authErrorText({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe("E-Mail oder Passwort falsch.");
  });

  it("reports too many attempts on status 429", () => {
    expect(authErrorText({ status: 429 })).toMatch(/Zu viele Versuche/);
  });

  it("falls back to a general sentence for unknown errors, without showing technical details", () => {
    expect(authErrorText({ code: "SOMETHING_NEW", status: 500, message: "db down" })).toBe(
      "Das hat nicht geklappt. Bitte später erneut versuchen.",
    );
    expect(authErrorText(null)).toMatch(/nicht geklappt/);
  });

  it("returns the same cases in English", () => {
    expect(authErrorText({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, "en")).toBe("Email or password is incorrect.");
    expect(authErrorText({ status: 429 }, "en")).toMatch(/Too many attempts/);
    expect(authErrorText({ code: "SOMETHING_NEW", status: 500 }, "en")).toBe("That did not work. Please try again later.");
  });

  it("has its own sentence in DE and EN for every sign-up and username code", () => {
    const codes = [...Object.values(REGISTRATION_ERROR), "USERNAME_IS_ALREADY_TAKEN", "INVALID_USERNAME_OR_PASSWORD"];
    for (const code of codes) {
      for (const locale of ["de", "en"] as const) {
        expect(authErrorText({ code }, locale)).not.toBe(authErrorText(null, locale));
      }
    }
  });
});
