import { Buffer } from "buffer";
export { Buffer };
export function isUtf8(input) {
  try { new TextDecoder("utf-8", { fatal: true }).decode(input); return true; } catch { return false; }
}
export default { Buffer, isUtf8 };
