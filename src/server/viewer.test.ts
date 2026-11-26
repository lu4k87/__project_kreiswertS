import { DrizzleQueryError } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ auth: { api: { getSession } } }));

import { getViewer, getViewerOrGuest } from "./viewer";

const headers = new Headers();
const dbDown = new Error("FAILED_TO_GET_SESSION", {
  cause: new DrizzleQueryError("select …", [], new Error("connect ECONNREFUSED")),
});

describe("getViewerOrGuest (pages)", () => {
  beforeEach(() => {
    getSession.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the member when the session can be read", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", siteId: 7 } });
    expect(await getViewerOrGuest(headers)).toEqual({ role: "member", userId: "u1", siteId: 7 });
  });

  it("shows the page as for a guest when the database is down", async () => {
    getSession.mockRejectedValue(dbDown);
    expect(await getViewerOrGuest(headers)).toEqual({ role: "guest" });
  });

  it("does not hide programming errors", async () => {
    getSession.mockRejectedValue(new TypeError("x is not a function"));
    await expect(getViewerOrGuest(headers)).rejects.toThrow(TypeError);
  });
});

describe("getViewer (API routes)", () => {
  it("still throws when the database is down, so the route can answer 503", async () => {
    getSession.mockRejectedValue(dbDown);
    await expect(getViewer(headers)).rejects.toBe(dbDown);
  });
});
