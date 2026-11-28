// AsyncLocalStorage without Node: the service worker handles one request at a time (see entry.js), so the store of the
// outermost run() may simply stay set until the next request resets it – streamed rendering after the handler returned still sees it.
const all = new Set();
export class AsyncLocalStorage {
  constructor() { this.store = undefined; all.add(this); }
  getStore() { return this.store; }
  enterWith(store) { this.store = store; }
  run(store, fn, ...args) {
    const previous = this.store;
    this.store = store;
    if (previous === undefined) return fn(...args); // outermost: kept until resetAsyncContext()
    let result;
    try { result = fn(...args); } catch (error) { this.store = previous; throw error; }
    if (result && typeof result.then === "function") {
      const restore = () => { if (this.store === store) this.store = previous; };
      result.then(restore, restore);
    } else this.store = previous;
    return result;
  }
  exit(fn, ...args) { const previous = this.store; this.store = undefined; try { return fn(...args); } finally { this.store = previous; } }
  static bind(fn) { return fn; }
  static snapshot() { return (fn, ...args) => fn(...args); }
}
export class AsyncResource {
  runInAsyncScope(fn, thisArg, ...args) { return fn.apply(thisArg, args); }
  bind(fn) { return fn; }
  static bind(fn) { return fn; }
}
export const executionAsyncId = () => 0;
export const triggerAsyncId = () => 0;
export const createHook = () => ({ enable() {}, disable() {} });
export function resetAsyncContext() { for (const storage of all) storage.store = undefined; }
export default { AsyncLocalStorage, AsyncResource, executionAsyncId, triggerAsyncId, createHook };
