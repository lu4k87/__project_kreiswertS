// The few node:crypto functions the app and its libraries use, on Web Crypto + @noble/hashes (already a dependency of Better Auth).
import { Buffer } from "buffer";
import { hmac } from "@noble/hashes/hmac.js";
import { md5, sha1 } from "@noble/hashes/legacy.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";

const ALGORITHMS = { md5, sha1, sha256, sha384, sha512 };
const algorithm = (name) => {
  const found = ALGORITHMS[String(name).toLowerCase().replace("-", "")];
  if (!found) throw new Error(`Digest method not supported: ${name}`);
  return found;
};
const bytes = (data, encoding) =>
  typeof data === "string" ? Buffer.from(data, encoding ?? "utf8")
    : data instanceof ArrayBuffer ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

class Hash {
  constructor(state) { this.state = state; }
  update(data, encoding) { this.state.update(bytes(data, encoding)); return this; }
  digest(encoding) { const out = Buffer.from(this.state.digest()); return encoding ? out.toString(encoding) : out; }
}
export const createHash = (name) => new Hash(algorithm(name).create());
export const createHmac = (name, key) => new Hash(hmac.create(algorithm(name), bytes(key)));
export const randomUUID = () => crypto.randomUUID();
export const getRandomValues = (array) => crypto.getRandomValues(array);
export function randomBytes(size, callback) {
  const out = Buffer.from(crypto.getRandomValues(new Uint8Array(size)));
  if (!callback) return out;
  callback(null, out);
}
export function timingSafeEqual(a, b) {
  if (a.byteLength !== b.byteLength) throw new RangeError("Input buffers must have the same byte length");
  const x = bytes(a), y = bytes(b);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}
export function scrypt(password, salt, keylen, options, callback) {
  if (typeof options === "function") { callback = options; options = {}; }
  scryptAsync(bytes(password), bytes(salt), {
    N: options.N ?? options.cost ?? 16384, r: options.r ?? options.blockSize ?? 8, p: options.p ?? options.parallelization ?? 1,
    dkLen: keylen, maxmem: options.maxmem,
  }).then((key) => callback(null, Buffer.from(key)), callback);
}
export const webcrypto = globalThis.crypto;
export const subtle = globalThis.crypto.subtle;
export default { createHash, createHmac, randomUUID, getRandomValues, randomBytes, timingSafeEqual, scrypt, webcrypto, subtle };
