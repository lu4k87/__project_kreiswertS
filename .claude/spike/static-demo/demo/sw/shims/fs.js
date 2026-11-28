// No file system in the browser: every file is "missing".
const missing = (path) => Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: "ENOENT", errno: -2, syscall: "open", path });
export const existsSync = () => false;
export const readFileSync = (path) => { throw missing(path); };
export const statSync = (path) => { throw missing(path); };
export const lstatSync = statSync;
export const readdirSync = () => [];
export const mkdirSync = () => undefined;
export const writeFileSync = () => undefined;
export const rmSync = () => undefined;
export const unlinkSync = () => undefined;
const reject = (path) => Promise.reject(missing(path));
export const promises = { readFile: reject, stat: reject, lstat: reject, access: reject, readdir: async () => [], mkdir: async () => undefined, writeFile: async () => undefined, rm: async () => undefined, unlink: async () => undefined, rename: async () => undefined };
export const { readFile, stat, lstat, access, readdir, mkdir, writeFile, rm, unlink, rename } = promises;
export const constants = {};
export default { existsSync, readFileSync, statSync, lstatSync, readdirSync, mkdirSync, writeFileSync, rmSync, unlinkSync, promises, constants };
