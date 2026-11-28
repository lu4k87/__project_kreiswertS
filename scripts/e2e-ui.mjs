#!/usr/bin/env node
// Browser checks of the platform layout in a real Chrome: the header menus, the offer and request forms with their
// list of sections, the 12-column pages of offers and requests. Each check guards a bug that was found while
// building the grid layouts (2026-11-28), e.g. a menu panel leaving a 360 px screen, a class constant from a
// "use client" file reaching a server component as a function, clipped header entries at 1344 px, a section
// scrolled to before it had opened, preview figures leaving the card at 360 px.
//
// Needs the installed Google Chrome (playwright-core, channel "chrome"). Never run it against the working
// database: it logs in and out with the demo logins and switches language and appearance.
//
//   export DATABASE_URL=postgres://…/kreiswerts_e2e  DEMO_PASSWORD=…  DEMO_ADMIN_PASSWORD=…  BETTER_AUTH_URL=http://localhost:3100
//   npx drizzle-kit push --force && node scripts/seed.mjs --reset-demo
//   npm run build && npx next start -H 127.0.0.1 -p 3100 > server.log 2>&1 &
//   node scripts/e2e-ui.mjs --base http://localhost:3100 [--only header,offer-form,…]
//
// Better Auth allows 3 login requests per 10 s for all clients together → one login per demo user and run, the
// session is reused, and the script pauses after every third login.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};
const BASE = arg("base", "http://localhost:3100");
const ONLY = arg("only", "")
  .split(",")
  .filter(Boolean);
const PASSWORDS = { site_a: process.env.DEMO_PASSWORD, admin_demo: process.env.DEMO_ADMIN_PASSWORD };
const DATABASE_URL = process.env.DATABASE_URL ?? "";

if (!PASSWORDS.site_a || !PASSWORDS.admin_demo) throw new Error("DEMO_PASSWORD and DEMO_ADMIN_PASSWORD are missing (the passwords the demo logins were seeded with)");
// Same guard as e2e-level1.mjs: only a test database and never the dev server.
const target = URL.canParse(DATABASE_URL) ? new URL(DATABASE_URL) : null;
if (!target?.pathname.endsWith("_e2e")) throw new Error("DATABASE_URL must name a database ending in _e2e");
if (new URL(BASE).port === "3000") throw new Error("--base points at port 3000 (the dev server with the working database)");

let passed = 0;
const failures = [];
function check(name, condition, detail = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` – ${detail}` : ""}`);
  console.log(`${condition ? "ok  " : "FAIL"} ${name}${!condition && detail ? ` – ${detail}` : ""}`);
}
const section = (title) => console.log(`\n── ${title}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const near = (value, expected, tolerance) => Math.abs(value - expected) <= tolerance;
const HEADER_HEIGHT = 69; // one header row: 68 px + border

const stateDir = mkdtempSync(path.join(tmpdir(), "kreiswerts-ui-"));
const stored = new Set();
let logins = 0;

/** POST a login; after every 3 logins wait until the 10 s window of the rate limit is over. */
async function login(context, user) {
  if (logins > 0 && logins % 3 === 0) await sleep(11_000);
  logins += 1;
  const response = await context.request.post(`${BASE}/api/auth/sign-in/username`, { data: { username: user, password: PASSWORDS[user] }, headers: { origin: BASE } });
  if (response.status() !== 200) throw new Error(`login of ${user} failed: HTTP ${response.status()}`);
}

/** A logged-in browser context; the session is stored per user, so a run logs in once per user. */
async function context(browser, { user = "site_a", width = 1440, height = 900, scheme = "dark", locale } = {}) {
  const file = path.join(stateDir, `${user}.json`);
  const options = { viewport: { width, height }, colorScheme: scheme };
  const ctx = await browser.newContext(stored.has(user) ? { ...options, storageState: file } : options);
  if (!stored.has(user)) {
    await login(ctx, user);
    await ctx.storageState({ path: file });
    stored.add(user);
  }
  if (locale) await ctx.addCookies([{ name: "locale", value: locale, url: BASE }]);
  return ctx;
}

/** A page that collects console errors and uncaught exceptions. */
async function open(ctx, urlPath, errors) {
  const page = await ctx.newPage();
  if (errors) {
    page.on("console", (message) => message.type() === "error" && errors.push(message.text().slice(0, 300)));
    page.on("pageerror", (error) => errors.push(String(error).slice(0, 300)));
  }
  await page.goto(BASE + urlPath);
  await page.waitForLoadState("networkidle");
  return page;
}

/** Widths of the direct children of the element matching `selector`'s parent grid, rounded. */
const childWidths = (page, selector) =>
  page.evaluate((sel) => [...document.querySelector(sel).parentElement.children].map((child) => Math.round(child.getBoundingClientRect().width)), selector);

/** Text inside `selector` that sticks out of its content box on the right or left (more than 1 px) – measured per text line,
 * because a long word overflows its box without making the box itself wider. */
const sticksOut = (page, selector) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const rect = root.getBoundingClientRect();
    const style = getComputedStyle(root);
    // the content box: text in the padding has left the card as well
    const box = { left: rect.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft), right: rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight) };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const out = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some((rect) => rect.width > 0 && (rect.right > box.right + 1 || rect.left < box.left - 1))) out.push(`"${node.textContent.trim().slice(0, 40)}"`);
    }
    return out.slice(0, 3);
  }, selector);

const noSidewaysScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

// ── Header menus (Kopf:B) ────────────────────────────────────────────────────────────────────────────────────────
async function header(browser) {
  section("Header: menus, keyboard, focus, widths");
  const errors = [];
  const ctx = await context(browser);
  const page = await open(ctx, "/dashboard", errors);
  const head = page.locator("body > header");
  const create = head.getByRole("button", { name: "Erstellen" });
  const account = head.getByRole("button", { name: "Kontomenü" });
  // by id: the button names change with the language
  const ids = { create: await create.getAttribute("aria-controls"), account: await account.getAttribute("aria-controls") };
  const panel = (key) => page.locator(`[id='${ids[key]}']`);
  const focused = () => page.evaluate(() => document.activeElement.textContent.trim().replace(/\s+/g, " "));
  const height = async (locator) => (await locator.boundingBox()).height;

  check("header is one row (68 px) at 1440", near(await height(head), HEADER_HEIGHT, 1.5), String(await height(head)));
  check("'Mein Konto' is no longer a main entry", (await head.getByRole("navigation").getByRole("link", { name: "Mein Konto" }).count()) === 0);
  check("six main entries without icons", (await head.locator("nav li").count()) === 6 && (await head.locator("nav svg").count()) === 0);
  check(
    "both menus start closed",
    (await create.getAttribute("aria-expanded")) === "false" && !(await panel("create").isVisible()) && !(await panel("account").isVisible()),
  );

  await create.click();
  check("click opens Create", (await create.getAttribute("aria-expanded")) === "true" && (await panel("create").isVisible()));
  const hrefs = await panel("create").getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  check("Create lists offer and request", hrefs.join() === "/my-offers/new,/my-requests/new", hrefs.join());
  await page.mouse.click(300, 500);
  check("click outside closes Create", (await create.getAttribute("aria-expanded")) === "false" && !(await panel("create").isVisible()));

  await create.focus();
  await page.keyboard.press("Enter");
  check("Enter opens, focus stays on the button", (await panel("create").isVisible()) && (await focused()).startsWith("Erstellen"));
  await page.keyboard.press("Escape");
  check("Escape closes and keeps the focus on the button", !(await panel("create").isVisible()) && (await focused()).startsWith("Erstellen"));
  await page.keyboard.press("ArrowDown");
  check("Arrow down opens and focuses the first entry", (await panel("create").isVisible()) && (await focused()).startsWith("Angebot erstellen"), await focused());
  await page.keyboard.press("ArrowDown");
  const second = await focused();
  await page.keyboard.press("ArrowDown");
  const wrapped = await focused();
  check("Arrow down walks and wraps", second.startsWith("Gesuch erstellen") && wrapped.startsWith("Angebot erstellen"), `${second} / ${wrapped}`);
  await page.keyboard.press("End");
  const last = await focused();
  await page.keyboard.press("Home");
  check("End / Home jump", last.startsWith("Gesuch erstellen") && (await focused()).startsWith("Angebot erstellen"));
  await page.keyboard.press("Escape");
  check("Escape from an entry returns to the button", !(await panel("create").isVisible()) && (await focused()).startsWith("Erstellen"));
  await page.keyboard.press("ArrowUp");
  check("Arrow up opens on the last entry", (await panel("create").isVisible()) && (await focused()).startsWith("Gesuch erstellen"));
  await page.keyboard.press("Tab");
  check(
    "Tab out closes Create and moves to the account button",
    !(await panel("create").isVisible()) && (await page.evaluate(() => document.activeElement.getAttribute("aria-label") || "")).startsWith("Kontomenü"),
  );

  await page.keyboard.press("Space");
  check("Space opens the account menu", await panel("account").isVisible());
  const texts = await panel("account").innerText();
  // Bug 2026-11-28: a class constant exported from a "use client" file reached the server component as a function.
  const classes = [
    ...(await panel("account").locator("a, button:not([lang])").evaluateAll((entries) => entries.map((entry) => entry.className))),
    ...(await panel("create").locator("a").evaluateAll((entries) => entries.map((entry) => entry.className))),
  ];
  check("menu entries carry real class names", classes.length > 0 && classes.every((name) => !name.includes("function") && name.includes("min-h-11")), classes.find((name) => !name.includes("min-h-11")));
  check(
    "account menu: company, my account, language, appearance, log out",
    ["Musterplast", "Mein Konto", "Sprache", "Darstellung", "Abmelden"].every((word) => texts.includes(word)),
    texts,
  );
  await create.click();
  check("opening one menu closes the other", (await panel("create").isVisible()) && !(await panel("account").isVisible()));
  await page.keyboard.press("Escape");

  // appearance: toggles the scheme and keeps the menu open
  await account.click();
  const row = panel("account").getByRole("button", { name: "Darstellung" });
  await row.click();
  await page.waitForTimeout(400);
  check(
    "appearance switches the scheme, menu stays open",
    (await page.evaluate(() => document.documentElement.dataset.theme)) === "light" && (await panel("account").isVisible()) && (await row.innerText()).includes("Hell"),
  );
  await row.click();
  await page.waitForTimeout(400);
  check("appearance switches back", (await page.evaluate(() => document.documentElement.dataset.theme)) === "dark" && (await row.innerText()).includes("Dunkel"));

  // language: English and back, the menu stays usable
  await panel("account").getByRole("button", { name: "en", exact: true }).click();
  await page.waitForTimeout(1200);
  check("language switch → English labels", (await head.getByRole("button", { name: "Create" }).count()) === 1 && (await panel("account").innerText()).includes("My account"));
  await panel("account").getByRole("button", { name: "de", exact: true }).click();
  await page.waitForTimeout(1200);
  check("language switch → back to German", (await head.getByRole("button", { name: "Erstellen" }).count()) === 1);

  // a link closes the menu and navigates
  if (!(await panel("account").isVisible())) await head.locator(`[aria-controls='${ids.account}']`).click();
  await panel("account").getByRole("link", { name: "Mein Konto" }).click();
  await page.waitForURL("**/account");
  check("'Mein Konto' navigates and the menu is closed", !(await panel("account").isVisible()));
  await create.click();
  await panel("create").getByRole("link", { name: "Gesuch erstellen" }).click();
  await page.waitForURL("**/my-requests/new");
  check("'Gesuch erstellen' navigates and the menu is closed", !(await panel("create").isVisible()));
  await ctx.close();

  // 360 px: one row, both panels inside the screen (bug 2026-11-28: "Create" left the screen)
  const narrow = await context(browser, { width: 360, height: 740, scheme: "light" });
  const small = await open(narrow, "/dashboard", errors);
  const tops = await small.evaluate(() =>
    [...document.querySelectorAll("body > header > div > a, body > header > div > div")].map((element) => Math.round(element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2)),
  );
  check("360 px: logo and actions share one row", near(tops[0], tops[1], 2), tops.join());
  check("360 px: no sideways scrolling", await noSidewaysScroll(small));
  for (const name of ["Erstellen", "Kontomenü"]) {
    const button = small.locator("body > header").getByRole("button", { name });
    await button.click();
    const box = await small.locator(`[id='${await button.getAttribute("aria-controls")}']`).boundingBox();
    check(`360 px: ${name} panel inside the screen`, box.x >= 0 && box.x + box.width <= 360, JSON.stringify(box));
    await small.keyboard.press("Escape");
  }
  await narrow.close();

  // administrator: no bell, no Create, seven entries in one row
  const admin = await context(browser, { user: "admin_demo" });
  const adminPage = await open(admin, "/dashboard", errors);
  const adminHead = adminPage.locator("body > header");
  check(
    "admin: seven entries, no Create, no bell",
    (await adminHead.locator("nav li").count()) === 7 &&
      (await adminHead.getByRole("button", { name: "Erstellen" }).count()) === 0 &&
      (await adminHead.locator("a[href='/notifications']").count()) === 0,
  );
  check("admin: one row at 1440", near(await height(adminHead), HEADER_HEIGHT, 1.5), String(await height(adminHead)));
  await admin.close();

  // 1344 px, where the entries move into the header row (bug 2026-11-28: German entries clipped at 1280 px);
  // 1343 px: entries in their own row – member and administrator, German and English
  const headerRow = (p) =>
    p.evaluate(() => {
      const element = document.querySelector("body > header");
      const list = element.querySelector("nav ul");
      return { h: element.getBoundingClientRect().height, clipped: list.scrollWidth > list.clientWidth + 1, over: document.documentElement.scrollWidth > innerWidth };
    });
  for (const user of ["site_a", "admin_demo"]) {
    const wide = await context(browser, { user, width: 1344, height: 800 });
    const widePage = await open(wide, "/dashboard", errors);
    let row = await headerRow(widePage);
    check(`1344 px ${user}: one row, all entries visible`, near(row.h, HEADER_HEIGHT, 1.5) && !row.clipped && !row.over, JSON.stringify(row));
    await widePage.setViewportSize({ width: 1343, height: 800 });
    await widePage.waitForTimeout(200);
    check(`1343 px ${user}: entries in their own row`, (await headerRow(widePage)).h > 100);
    await widePage.setViewportSize({ width: 1280, height: 800 });
    await widePage.waitForTimeout(200);
    row = await headerRow(widePage);
    check(`1280 px ${user}: entries in their own row or all visible`, row.h > 100 || !row.clipped, JSON.stringify(row));
    await wide.addCookies([{ name: "locale", value: "en", url: BASE }]);
    await widePage.setViewportSize({ width: 1344, height: 800 });
    await widePage.reload();
    await widePage.waitForLoadState("networkidle");
    row = await headerRow(widePage);
    check(`1344 px ${user}, English: one row, all entries visible`, near(row.h, HEADER_HEIGHT, 1.5) && !row.clipped && !row.over, JSON.stringify(row));
    await wide.close();
  }

  // log out from the account menu in an own session, so the stored login of the other checks stays valid
  const out = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await login(out, "site_a");
  const outPage = await open(out, "/dashboard");
  await outPage.locator("body > header").getByRole("button", { name: "Kontomenü" }).click();
  await outPage.getByRole("button", { name: "Abmelden" }).click();
  await outPage.waitForURL(`${BASE}/`, { timeout: 15_000 });
  const session = (await (await out.request.get(`${BASE}/api/auth/get-session`)).text()).trim();
  check("log out from the menu ends the session and returns to the start page", session === "null" || session === "");
  await out.close();

  check("header: no console or page errors", errors.length === 0, errors.join(" | ").slice(0, 600));
}

// ── Forms with a list of sections (Form:A): offer and request form ──────────────────────────────────────────────────────────────────────
/**
 * Checks one form page: numbered sections in a list (click, keyboard, focus, current marker), columns 3 / 6 / 3 from
 * 1280 px, the list as a row above fields 8 + side column 4 from 1024 px, one column at 360 px.
 * `form.closable` is the id of a section that the click test closes first; `form.side` the selector of the right column.
 */
async function formPage(browser, label, urlPath, form) {
  section(`${label} (${urlPath})`);
  const errors = [];
  const ctx = await context(browser);
  const page = await open(ctx, urlPath, errors);
  await page.waitForTimeout(800);
  const links = page.getByRole("navigation", { name: "Abschnitte" }).getByRole("link");
  const numbers = (await links.allInnerTexts()).map((text) => text.split("\n")[0].trim());
  check(`${form.count} numbered sections`, numbers.join() === Array.from({ length: form.count }, (_, i) => String(i + 1)).join(), numbers.join());
  const cols = await childWidths(page, "nav[aria-labelledby=form-sections]");
  check("1440: columns 3 / 6 / 3", cols.length === 3 && near(cols[0], cols[2], 1) && near(cols[1], 2 * cols[0] + 24, 2), cols.join());
  check("first section is marked as current", (await links.nth(0).getAttribute("aria-current")) === "step" && (await links.nth(form.jump).getAttribute("aria-current")) === null);
  if (form.extra) await form.extra(page);

  // click: opens a closed section, scrolls to it once it is open (bug 2026-11-28: scrolled before it had opened),
  // focus on its heading row, marker moves
  // sections that fold (<details>) are closed first; always open ones (<section>) put the focus on their heading
  const collapsible = form.collapsible !== false;
  const jumpTarget = page.locator(`#${form.closable}`);
  if (collapsible && (await jumpTarget.evaluate((element) => element.open))) {
    await jumpTarget.locator("> summary").click();
    await page.waitForTimeout(200);
  }
  const wasClosed = collapsible && !(await jumpTarget.evaluate((element) => element.open));
  await links.nth(form.jump).click();
  await page.waitForTimeout(900);
  const top = (await jumpTarget.boundingBox()).y;
  if (collapsible) check("click opens the section", wasClosed && (await jumpTarget.evaluate((element) => element.open)));
  const atEnd = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
  check("click scrolls the section to the top (or the page to its end)", (top >= -2 && top <= 30) || (atEnd && top < 900), `${top} end=${atEnd}`);
  check("focus is on the section's heading row", (await page.evaluate(() => `${document.activeElement.tagName}:${document.activeElement.parentElement.id}`)) === `${collapsible ? "SUMMARY" : "H2"}:${form.closable}`);
  check(`marker moved to section ${form.jump + 1}`, (await links.nth(form.jump).getAttribute("aria-current")) === "step" && (await links.nth(0).getAttribute("aria-current")) === null);

  // keyboard: Enter on a link; focus in a field marks its section
  const lastIndex = form.count - 1;
  await links.nth(lastIndex).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  check(
    `Enter on a link goes to section ${form.count}`,
    (await page.evaluate(() => document.activeElement.parentElement.id)) === form.last && (await links.nth(lastIndex).getAttribute("aria-current")) === "step",
  );
  await page.locator(form.firstField).focus();
  await page.waitForTimeout(100);
  check("focus in a field marks its section", (await links.nth(0).getAttribute("aria-current")) === "step");
  check("the form was not marked as changed by navigating", (await page.getByText("Ungespeicherte").count()) === 0);

  // the longest values the side column has to hold (after the check above, it marks the form as changed)
  if (form.longest) await form.longest(page);

  // 1100 px: sections as a row above, fields 8 + side column 4; 360 px: one column, nothing wider than the screen
  for (const [width, expect] of [
    [1100, "row"],
    [360, "one"],
  ]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => {
      const nav = document.querySelector("nav[aria-labelledby=form-sections]");
      const grid = nav.parentElement;
      const rect = (element) => element.getBoundingClientRect();
      return { nav: rect(nav).width, grid: rect(grid).width, form: rect(grid.children[1]).width, aside: rect(grid.children[2]).width, asideLeft: rect(grid.children[2]).left, formLeft: rect(grid.children[1]).left };
    });
    if (expect === "row") check("1100: sections full width, side column beside the fields", near(box.nav, box.grid, 1) && box.asideLeft > box.formLeft + 100, JSON.stringify(box));
    else check("360: one column", near(box.form, box.grid, 1) && near(box.aside, box.grid, 1) && near(box.asideLeft, box.formLeft, 1), JSON.stringify(box));
    check(`${width}: no sideways scrolling`, await noSidewaysScroll(page));
  }
  // bug 2026-11-28: figures of the live preview left the card at 360 px
  const outside = await sticksOut(page, form.side);
  check("360: nothing sticks out of the side column", outside.length === 0, outside.join(", "));
  check("no console or page errors", errors.length === 0, errors.join(" || ").slice(0, 600));
  await ctx.close();
}

/** First link on `listPath` whose href matches `pattern` (an own offer or request to edit). */
async function firstHref(browser, listPath, pattern) {
  const ctx = await context(browser);
  const page = await open(ctx, listPath);
  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  await ctx.close();
  const href = hrefs.find((candidate) => pattern.test(candidate));
  if (!href) throw new Error(`no link matching ${pattern} on ${listPath}`);
  return href;
}

/** Figures of the live preview: one column from 1024 px (only with a title, so on the edit page). */
async function previewFigures(page) {
  const columns = await page.evaluate(() => {
    const row = document.querySelector("aside[aria-labelledby=live-preview] dl > div");
    return row ? getComputedStyle(row.parentElement).gridTemplateColumns : "none";
  });
  check("preview figures in one column at 1440", columns !== "none" && !columns.trim().includes(" "), columns);
}

const OFFER_FORM = {
  count: 7,
  jump: 4,
  closable: "section-pricing",
  last: "section-evidence",
  firstField: "#title",
  side: "aside[aria-labelledby=live-preview]",
  // "Wiederkehrende Menge · vierteljährlich" is the longest figure of the preview; a title makes the figures appear on the new form
  async longest(page) {
    if (!(await page.locator("#title").inputValue())) await page.locator("#title").fill("Polypropylen-Mahlgut aus Spritzgussangüssen");
    await page.locator("#section-quantity").evaluate((element) => (element.open = true));
    await page.locator("#frequency").selectOption("recurring");
    await page.locator("#recurrencePeriod").selectOption("quarterly");
    await page.waitForTimeout(200);
  },
};

const REQUEST_FORM = {
  count: 5,
  jump: 3,
  collapsible: false,
  closable: "section-origin",
  last: "section-commercial",
  firstField: "#title",
  side: "aside[aria-labelledby=matching-explainer]",
};

async function requestForm(browser) {
  await formPage(browser, "Request form, edit", (await firstHref(browser, "/my-requests", /^\/my-requests\/\d+\/edit$/)), REQUEST_FORM);
  await formPage(browser, "Request form, new", "/my-requests/new", REQUEST_FORM);
}

async function offerForm(browser) {
  await formPage(browser, "Offer form, edit", await firstHref(browser, "/my-offers", /^\/my-offers\/\d+\/edit$/), { ...OFFER_FORM, extra: previewFigures });
  await formPage(browser, "Offer form, new", "/my-offers/new", OFFER_FORM);
}

// ── Request list (like the offer list "Liste:B") ───────────────────────────────────────────────────────────────────
/** Grid columns of every result row and the left edge of its facts. */
const rows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("section[aria-labelledby=results] li > article")].map((article) => ({
      columns: getComputedStyle(article).gridTemplateColumns.split(" ").length,
      facts: Math.round(article.querySelector("dl").getBoundingClientRect().left),
    })),
  );

async function requestList(browser) {
  section("Request list: filter bar, rows with fixed columns");
  const errors = [];
  // the administrator sees the requests of all sites (a site sees only the others' requests around it)
  const ctx = await context(browser, { user: "admin_demo" });
  const page = await open(ctx, "/requests", errors);
  const widths = await page.evaluate(() => {
    const form = document.querySelector("main form[method=get]");
    return { form: Math.round(form.getBoundingClientRect().width), results: Math.round(document.querySelector("section[aria-labelledby=results]").getBoundingClientRect().width) };
  });
  check("1440: filters as a bar as wide as the results", widths.form === widths.results, JSON.stringify(widths));
  const groups = await page.locator("main form [role=group]").evaluateAll((list) => list.map((group) => getComputedStyle(group).gridTemplateColumns.split(" ").length));
  check("1440: both filter groups with their name in a column on the left", groups.join() === "2,2", groups.join());
  let list = await rows(page);
  check("several requests listed", list.length >= 2, String(list.length));
  check("1440: every result is a row with three columns", list.every((row) => row.columns === 3), JSON.stringify(list));
  check("1440: the facts start at the same place in every row", new Set(list.map((row) => row.facts)).size === 1, list.map((row) => row.facts).join());
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(300);
  list = await rows(page);
  check("360: results as cards in one column", list.every((row) => row.columns === 1), JSON.stringify(list));
  check("360: no sideways scrolling", await noSidewaysScroll(page));
  const outside = await sticksOut(page, "section[aria-labelledby=results] li:first-child > article");
  check("360: nothing sticks out of a result card", outside.length === 0, outside.join(", "));
  // the row layout belongs to the list only: My requests keeps the cards
  const member = await context(browser);
  const mine = await open(member, "/my-requests", errors);
  const own = await mine.locator("main article").evaluateAll((articles) => articles.map((article) => getComputedStyle(article).gridTemplateColumns.split(" ").length));
  check("My requests: still cards in one column", own.length > 0 && own.every((columns) => columns === 1), own.join());
  check("no console or page errors", errors.length === 0, errors.join(" || ").slice(0, 600));
  await member.close();
  await ctx.close();
}

// ── Detail pages on the 12-column grid ("Detail:A") ────────────────────────────────────────────────────────────────
/** Box of the section with `id` (its card), or null. */
const sectionBox = (page, id) => page.evaluate((sectionId) => {
  const element = document.getElementById(sectionId)?.closest("section") ?? document.getElementById(sectionId);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { left: Math.round(rect.left), top: Math.round(rect.top + scrollY), width: Math.round(rect.width) };
}, id);

/**
 * One detail page: at 1440 the `left` sections in 8 columns, the `right` ones in 4 columns beside them; at 360 one
 * column in `order` (ids from top to bottom), nothing wider than the screen, no text outside the `card` (selector).
 */
async function detailPage(browser, label, urlPath, { user = "site_a", left, right, order, card = "section:has(#key-facts)" }) {
  section(`${label} (${urlPath})`);
  const errors = [];
  const ctx = await context(browser, { user });
  const page = await open(ctx, urlPath, errors);
  const leftBox = await sectionBox(page, left);
  const rightBoxes = await Promise.all(right.map((id) => sectionBox(page, id)));
  check(`1440: ${right.join(", ")} present`, rightBoxes.every(Boolean), right.filter((_, i) => !rightBoxes[i]).join());
  check("1440: sections in 8 columns, side column in 4 beside them", Boolean(leftBox) && rightBoxes.every((box) => box && box.left > leftBox.left + leftBox.width && near(leftBox.width, 2 * box.width + 24, 3)), JSON.stringify({ leftBox, rightBoxes }));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(300);
  const tops = await Promise.all(order.map((id) => sectionBox(page, id)));
  const sorted = tops.every((box, i) => box && (i === 0 || box.top > tops[i - 1].top));
  check(`360: one column in the order ${order.join(" → ")}`, sorted, tops.map((box, i) => `${order[i]}:${box?.top}`).join(" "));
  check("360: no sideways scrolling", await noSidewaysScroll(page));
  const outside = await sticksOut(page, card);
  check(`360: nothing sticks out of ${card}`, outside.length === 0, outside.join(", "));
  check("no console or page errors", errors.length === 0, errors.join(" || ").slice(0, 600));
  await ctx.close();
}

async function requestDetail(browser) {
  const others = await firstHref(browser, "/requests?scope=radius&radiusKm=200", /^\/requests\/\d+$/);
  await detailPage(browser, "Request of another site", others, { left: "material", right: ["key-facts", "respond", "requester"], order: ["key-facts", "material", "commercial", "respond", "requester"] });
  const own = await firstHref(browser, "/my-requests", /^\/requests\/\d+$/);
  await detailPage(browser, "Own request", own, { left: "material", right: ["key-facts", "manage", "requester"], order: ["key-facts", "material", "commercial", "manage", "requester"] });
}

async function matchDetail(browser) {
  const match = await firstHref(browser, "/matches", /^\/matches\/\d+\/\d+$/);
  await detailPage(browser, "Match", match, { left: "result", right: ["missing"], order: ["result", "requirements", "preferences", "missing"], card: "section:has(#result)" });
}

// ── Matches list ("Treffer:C") ─────────────────────────────────────────────────────────────────────────────────────
/** Per group of both directions: widths of the own-listing box and the candidates column, left edges. */
const matchGroups = (page) =>
  page.evaluate(() =>
    ["for-requests", "for-offers"].flatMap((id) =>
      [...document.getElementById(id).closest("section").querySelectorAll(":scope > div.grid > div")].map((group) => {
        const [own, candidates] = [...group.children].map((child) => child.getBoundingClientRect());
        return { own: Math.round(own.width), candidates: Math.round(candidates.width), ownLeft: Math.round(own.left), candidatesLeft: Math.round(candidates.left) };
      }),
    ),
  );

async function matchList(browser) {
  section("Matches list: own listing left, candidates right");
  const errors = [];
  const ctx = await context(browser);
  const page = await open(ctx, "/matches", errors);
  let groups = await matchGroups(page);
  check("groups in both directions", groups.length >= 2, String(groups.length));
  check("1440: own listing in 4 columns, its candidates in 8 beside it", groups.every((g) => g.candidatesLeft > g.ownLeft + g.own && near(g.candidates, 2 * g.own + 24, 3)), JSON.stringify(groups));
  const split = await page.evaluate(() =>
    [...document.querySelectorAll("main li > article")].map((article) => {
      const dl = article.querySelector("dl").getBoundingClientRect();
      const ul = article.querySelector("ul").getBoundingClientRect();
      return { details: Math.round(ul.left), facts: Math.round(dl.right), top: Math.round(ul.top - article.querySelector("dl").closest("article").getBoundingClientRect().top) };
    }),
  );
  check("1440: candidate cards show their details right of the facts", split.length > 0 && split.every((card) => card.details >= card.facts), JSON.stringify(split));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(300);
  groups = await matchGroups(page);
  check("360: box above its candidates in one column", groups.every((g) => near(g.ownLeft, g.candidatesLeft, 1) && near(g.own, g.candidates, 1)), JSON.stringify(groups));
  check("360: no sideways scrolling", await noSidewaysScroll(page));
  const outside = await sticksOut(page, "main li:first-child > article");
  check("360: nothing sticks out of a candidate card", outside.length === 0, outside.join(", "));
  check("no console or page errors", errors.length === 0, errors.join(" || ").slice(0, 600));
  await ctx.close();
}

const GROUPS = { header, "offer-form": offerForm, "request-list": requestList, "request-detail": requestDetail, "request-form": requestForm, "match-detail": matchDetail, "match-list": matchList };

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [name, run] of Object.entries(GROUPS)) if (ONLY.length === 0 || ONLY.includes(name)) await run(browser);
} catch (error) {
  failures.push(`aborted: ${error.message}`);
  console.log(`FAIL aborted – ${error.stack}`);
} finally {
  await browser.close();
  rmSync(stateDir, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log(failures.map((failure) => `  - ${failure}`).join("\n"));
  process.exit(1);
}
