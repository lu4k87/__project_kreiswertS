import * as pathe from "pathe";
export * from "pathe";
export const posix = pathe;
export default { ...pathe, posix: pathe };
