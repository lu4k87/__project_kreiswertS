import { DrizzleQueryError } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, siteRows } = vi.hoisted(() => ({ getSession: vi.fn(), siteRows: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ auth: { api: { getSession } } }));
// The site of a member is read with db.select(…).from(sites).where(…).limit(1).
vi.mock("./db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: siteRows }) }) }) } }));

import { getViewer, getViewerOrGuest } from "./viewer";

const headers = new Headers();
const dbDown = new Error("FAILED_TO_GET_SESSION", {
  cause: new DrizzleQueryError("select …", [], new Error("connect ECONNREFUSED")),
});

describe("getViewerOrGuest (pages)", () => {
  beforeEach(() => {
    getSession.mockReset();
    siteRows.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the member with the current state of the site", async () => {
    const site = { id: 7, status: "pending", parkId: 2, latitude: null, longitude: null };
    getSession.mockResolvedValue({ user: { id: "u1", siteId: 7, role: "member" } });
    siteRows.mockResolvedValue([site]);
    expect(await getViewerOrGuest(headers)).toEqual({ role: "member", userId: "u1", site });
  });

  it("a member without a finished registration has no site", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", siteId: null, role: "member" } });
    expect(await getViewerOrGuest(headers)).toEqual({ role: "member", userId: "u1", site: null });
    expect(siteRows).not.toHaveBeenCalled();
  });

  it("the administrator role comes from the user row and carries no site", async () => {
    getSession.mockResolvedValue({ user: { id: "a1", siteId: null, role: "admin" } });
    expect(await getViewerOrGuest(headers)).toEqual({ role: "admin", userId: "a1" });
  });

  it("an unknown role value counts as member, never as administrator", async () => {
    getSession.mockResolvedValue({ user: { id: "u1", siteId: null, role: "superuser" } });
    expect((await getViewerOrGuest(headers)).role).toBe("member");
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
