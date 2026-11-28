/** Initials for the account button: the first letters of the first two words that start with a letter
 *  ("Musterplast Fertigung GmbH (fiktiv)" → "MF"). Empty when the name has no such word. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => [...word][0].toLocaleUpperCase())
    .join("");
}
