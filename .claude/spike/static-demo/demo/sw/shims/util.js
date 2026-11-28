// What React's server build takes from node:util.
export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;
export const promisify = (fn) => (...args) => new Promise((resolve, reject) => fn(...args, (error, value) => (error ? reject(error) : resolve(value))));
export const inspect = (value) => { try { return JSON.stringify(value); } catch { return String(value); } };
export const inherits = (ctor, superCtor) => Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
export const types = {};
export default { TextEncoder, TextDecoder, promisify, inspect, inherits, types };
