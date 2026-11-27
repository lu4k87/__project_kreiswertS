// CSV as spreadsheets write it (RFC 4180): fields in double quotes may hold the delimiter, line breaks and "" for
// a quote. Reading accepts "," or ";" (German Excel) – the header line decides – and drops a UTF-8 byte order mark.
// Text that a spreadsheet would run as a formula (= + - @ at the start, CWE-1236) is written with a leading ' and
// read back without it, so an exported description can never execute in Excel. Numbers and phone numbers
// (-6.5, +49 2842 1234) stay as they are: without letters there is no function to call.

const FORMULA = /^[=+\-@\t\r]/;
const PLAIN = /^[0-9 .,()/+-]*$/;
const unguard = (value) => (value.startsWith("'") && FORMULA.test(value.slice(1)) ? value.slice(1) : value);

/** Parses CSV text into rows of strings; empty lines are skipped. */
export function parseCsv(text) {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = source.slice(0, source.search(/\r?\n|$/));
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row.map(unguard));
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV: a quoted field is not closed");
  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row.map(unguard));
  return rows;
}

/** Writes rows as CSV with CRLF line ends and a byte order mark, so Excel opens umlauts correctly. */
export function toCsv(rows, delimiter = ",") {
  const cell = (value) => {
    const raw = value === null || value === undefined ? "" : String(value);
    const text = FORMULA.test(raw) && !PLAIN.test(raw) ? `'${raw}` : raw;
    return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `\ufeff${rows.map((row) => row.map(cell).join(delimiter)).join("\r\n")}\r\n`;
}
