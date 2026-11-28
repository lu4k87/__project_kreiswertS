// Static demo on GitHub Pages (demo/, `npm run demo:build`): the whole app runs in the visitor's browser.
// The demo build sets NEXT_PUBLIC_DEMO_STATIC; in the normal app it is unset and everything here is off.
export const DEMO_STATIC = process.env.NEXT_PUBLIC_DEMO_STATIC === "1";
