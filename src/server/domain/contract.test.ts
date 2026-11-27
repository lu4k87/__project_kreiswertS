import { describe, expect, it } from "vitest";
import { canonicalJson, contractActions, contractExecution, contractRef, type ExecutionInput } from "./contract";

describe("contract snapshot", () => {
  it("the same content gives the same text, whatever the key order", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(canonicalJson({ a: { c: null, d: [2, 1] }, b: 1 }));
    expect(canonicalJson({ b: 1, a: "x" })).toBe('{"a":"x","b":1}');
  });

  it("a changed value or array order changes the text", () => {
    expect(canonicalJson({ a: [1, 2] })).not.toBe(canonicalJson({ a: [2, 1] }));
    expect(canonicalJson({ price: 120 })).not.toBe(canonicalJson({ price: 121 }));
  });

  it("leaves out undefined like JSON.stringify", () => {
    expect(canonicalJson({ a: undefined, b: 2 })).toBe('{"b":2}');
  });

  it("references are CT- plus six digits", () => expect(contractRef(42)).toBe("CT-000042"));
});

describe("who may sign or void", () => {
  it("each site signs once and may void while a signature is missing", () => {
    expect(contractActions("awaiting_signatures", false)).toEqual(["sign", "void"]);
    expect(contractActions("awaiting_signatures", true)).toEqual(["void"]);
  });
  it("a signed or voided contract allows nothing", () => {
    expect(contractActions("signed", true)).toEqual([]);
    expect(contractActions("voided", false)).toEqual([]);
  });
});

describe("contract execution", () => {
  const delivered = { status: "completed" as const, qualityResult: "accepted" as const, receivedQuantity: 148 };
  const base: ExecutionInput = { status: "signed", exchange: null, payment: { due: true, status: null } };

  it("waits for signatures and stays voided without execution", () => {
    expect(contractExecution({ ...base, status: "awaiting_signatures" }).state).toBe("awaiting_signatures");
    expect(contractExecution({ ...base, status: "voided" }).state).toBe("voided");
  });

  it("is in execution until the material arrived and the payment was captured", () => {
    expect(contractExecution(base).state).toBe("in_execution");
    expect(contractExecution({ ...base, exchange: delivered, payment: { due: true, status: "authorised" } })).toEqual({ state: "in_execution", delivery: "met", payment: "open" });
    expect(contractExecution({ ...base, exchange: delivered, payment: { due: true, status: "captured" } })).toEqual({ state: "fulfilled", delivery: "met", payment: "met" });
  });

  it("is fulfilled by delivery alone when no payment is due", () => {
    expect(contractExecution({ ...base, exchange: delivered, payment: { due: false, status: null } }).state).toBe("fulfilled");
  });

  it("is terminated when the delivery failed and no captured money is left", () => {
    const cancelled = { status: "cancelled" as const, qualityResult: null, receivedQuantity: null };
    const rejected = { status: "completed" as const, qualityResult: "rejected" as const, receivedQuantity: 0 };
    expect(contractExecution({ ...base, exchange: cancelled, payment: { due: true, status: "cancelled" } }).state).toBe("terminated");
    expect(contractExecution({ ...base, exchange: rejected, payment: { due: true, status: null } }).state).toBe("terminated");
    // captured money of a failed delivery still has to be refunded – the contract is not over yet
    expect(contractExecution({ ...base, exchange: rejected, payment: { due: true, status: "captured" } }).state).toBe("in_execution");
    expect(contractExecution({ ...base, exchange: rejected, payment: { due: true, status: "refunded" } })).toEqual({ state: "terminated", delivery: "failed", payment: "reversed" });
  });
});
