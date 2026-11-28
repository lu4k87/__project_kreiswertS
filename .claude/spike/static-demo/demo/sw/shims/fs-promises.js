import { promises } from "./fs.js";
export const { readFile, stat, lstat, access, readdir, mkdir, writeFile, rm, unlink, rename } = promises;
export default promises;
