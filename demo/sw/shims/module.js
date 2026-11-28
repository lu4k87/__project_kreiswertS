// The HTML renderer asks for React through require(): hand it the bundled copies.
import reactDom from "react-dom";
import reactDomStatic from "react-dom/static";
import asyncHooks from "./async_hooks.js";
import buffer from "./buffer.js";
import crypto from "./crypto.js";
import fs from "./fs.js";
import os from "./os.js";
import path from "./path.js";
import stream from "./stream.js";
import url from "./url.js";
import util from "./util.js";
const BUILTINS = { async_hooks: asyncHooks, buffer, crypto, fs, os, path, stream, url, util, "react-dom": reactDom, "react-dom/static": reactDomStatic };
export const createRequire = () => (id) => {
  const found = BUILTINS[String(id).replace(/^node:/, "")];
  if (found) return found;
  throw Object.assign(new Error(`Cannot find module '${id}'`), { code: "MODULE_NOT_FOUND" });
};
export default { createRequire };
