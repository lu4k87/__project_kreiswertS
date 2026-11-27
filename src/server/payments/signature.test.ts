import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "./signature";

const secret = "test-secret-with-enough-length-0123456789";
const body = '{"id":"evt_1","type":"payment.authorised"}';
const now = 1_800_000_000;

describe("provider confirmation signature", () => {
  it("accepts its own signature within the time window", () => {
    expect(verifySignature(secret, body, signPayload(secret, body, now), now + 10)).toBeNull();
  });
  it("refuses a changed body, another secret, a missing or malformed header", () => {
    const header = signPayload(secret, body, now);
    expect(verifySignature(secret, body.replace("authorised", "captured"), header, now)).toBe("MISMATCH");
    expect(verifySignature("another-secret-of-enough-length-000000", body, header, now)).toBe("MISMATCH");
    expect(verifySignature(secret, body, null, now)).toBe("MISSING");
    expect(verifySignature(secret, body, "t=abc,v1=xyz", now)).toBe("MALFORMED");
    expect(verifySignature(secret, body, `t=${now}`, now)).toBe("MALFORMED");
  });
  it("refuses a replay outside the tolerance", () => {
    expect(verifySignature(secret, body, signPayload(secret, body, now), now + 301)).toBe("EXPIRED");
    expect(verifySignature(secret, body, signPayload(secret, body, now + 400), now)).toBe("EXPIRED");
  });
});
