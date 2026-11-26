#!/usr/bin/env python3
"""Turn invisible characters in TypeScript sources into visible escapes.

A literal no-break space or zero-width character in a string looks like a plain space (or like nothing) in every
editor and diff. This script rewrites them as \\uXXXX escapes, which TypeScript reads as the same character.
Only use such characters inside string or template literals – JSX text does not process escapes.

Usage: python3 scripts/escape-invisible.py [--check]   (--check: list the files, change nothing, exit 1 if any)
"""
import pathlib
import sys

# no-break and zero-width spaces, line/paragraph separators, direction overrides …
INVISIBLE = {0x00A0, 0x200B, 0x2028, 0x2029, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x202F, 0x2060, 0x2066, 0x2067, 0x2068, 0x2069}
# … and control characters except tab, line feed and carriage return (a NUL byte makes git treat the file as binary)
INVISIBLE |= {code for code in range(0x20) if code not in (0x09, 0x0A, 0x0D)} | set(range(0x7F, 0xA0))
BACKSLASH = chr(92)


def escaped(text: str) -> str:
    return "".join(f"{BACKSLASH}u{ord(c):04x}" if ord(c) in INVISIBLE else c for c in text)


def main() -> int:
    check = "--check" in sys.argv
    root = pathlib.Path(__file__).resolve().parent.parent / "src"
    changed = []
    for path in sorted(list(root.rglob("*.ts")) + list(root.rglob("*.tsx"))):
        text = path.read_text(encoding="utf-8")
        fixed = escaped(text)
        if fixed != text:
            changed.append(path.relative_to(root.parent))
            if not check:
                path.write_text(fixed, encoding="utf-8")
    for path in changed:
        print(("has invisible characters: " if check else "escaped: ") + str(path))
    return 1 if check and changed else 0


if __name__ == "__main__":
    sys.exit(main())
