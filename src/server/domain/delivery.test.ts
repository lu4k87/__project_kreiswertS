import { describe, expect, it } from "vitest";
import { RESPONSIBILITIES, deliveryMode, isFormalTerm, offersMode } from "./delivery";
import { DELIVERY_TERMS } from "./listing";

describe("delivery arrangements (L1-009, D07)", () => {
  it("AT-L1-009: FCA assigns loading to the offerer, DAP assigns unloading to the requester", () => {
    expect(RESPONSIBILITIES.fca).toEqual({ loading: "offerer", transport: "requester", unloading: "requester" });
    expect(RESPONSIBILITIES.dap).toEqual({ loading: "offerer", transport: "offerer", unloading: "requester" });
    expect(RESPONSIBILITIES.exw.loading).toBe("requester");
    expect(RESPONSIBILITIES.dpu.unloading).toBe("offerer");
  });

  it("AT-L1-009: a collection-only batch does not appear under delivery by the offerer", () => {
    expect(offersMode(["exw", "fca"], "delivered")).toBe(false);
    expect(offersMode(["exw", "fca"], "collection")).toBe(true);
    expect(offersMode(["fca", "dap"], "delivered")).toBe(true);
    expect(offersMode(["dpu"], "collection")).toBe(false);
  });

  it("NT-L1-009: a custom arrangement is not a formal term and has no fixed responsibilities", () => {
    expect(isFormalTerm("custom")).toBe(false);
    expect(RESPONSIBILITIES.custom).toEqual({ loading: null, transport: null, unloading: null });
    expect(deliveryMode("custom")).toBe("collection");
    expect(DELIVERY_TERMS.filter(isFormalTerm)).toEqual(["exw", "fca", "dap", "dpu"]);
  });
});
