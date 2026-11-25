import { describe, expect, it } from "vitest";
import { registrationError, vatIdSchema } from "./registration";

const valid = {
  companyName: "Rhein Polymer GmbH",
  vatId: "DE 294 681 207",
  materialInterest: "plastics",
  username: "rhein.polymer",
  email: "einkauf@rhein-polymer.example",
  password: "Sicher123",
};

describe("registrationError", () => {
  it("accepts a complete, valid registration", () => {
    expect(registrationError(valid)).toBeNull();
  });

  it.each([
    [{ companyName: " " }, "INVALID_COMPANY_NAME"],
    [{ companyName: undefined }, "INVALID_COMPANY_NAME"],
    [{ vatId: "123" }, "INVALID_VAT_ID"],
    [{ vatId: "DE" }, "INVALID_VAT_ID"],
    [{ materialInterest: "gold" }, "INVALID_MATERIAL_INTEREST"],
    [{ username: undefined }, "INVALID_USERNAME"], // sign-up past the form, without a username
    [{ username: "ab" }, "INVALID_USERNAME"],
    [{ username: "rhein polymer" }, "INVALID_USERNAME"],
    [{ email: "name@firma" }, "INVALID_EMAIL"], // passes the browser's type="email", has no domain ending
    [{ email: "keine-mail" }, "INVALID_EMAIL"],
    [{ email: undefined }, "INVALID_EMAIL"],
    [{ email: `${"a".repeat(250)}@x.de` }, "INVALID_EMAIL"], // longer than 254 characters
    [{ password: "sicher123" }, "PASSWORD_TOO_WEAK"], // no capital letter
    [{ password: "SicherSicher" }, "PASSWORD_TOO_WEAK"], // no number
    [{ password: "Sich3r" }, "PASSWORD_TOO_WEAK"], // too short
  ])("rejects %o with %s", (change, code) => {
    expect(registrationError({ ...valid, ...change })).toBe(code);
  });

  it("rejects a missing body", () => {
    expect(registrationError(undefined)).toBe("INVALID_COMPANY_NAME");
  });
});

describe("vatIdSchema", () => {
  it("normalises spaces, dots and case", () => {
    expect(vatIdSchema.parse("de 294.681-207")).toBe("DE294681207");
  });
});
