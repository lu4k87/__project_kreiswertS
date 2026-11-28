export const fileURLToPath = (url) => decodeURIComponent(new URL(url).pathname);
export const pathToFileURL = (path) => new URL(`file://${path}`);
export const URL = globalThis.URL;
export const URLSearchParams = globalThis.URLSearchParams;
export default { fileURLToPath, pathToFileURL, URL, URLSearchParams };
