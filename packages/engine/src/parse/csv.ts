/**
 * A small RFC 4180 CSV tokeniser.
 *
 * Deliberately dependency-free. Bank exports are not clean CSV — they carry a
 * preamble, ragged row lengths, trailing separator columns, CRLF endings, and
 * quoted narrations containing commas ("UPI-SWIGGY, BANGALORE-..."). A naive
 * `line.split(',')` shears those narrations in half and silently corrupts the
 * merchant key that every downstream mandate is grouped by.
 *
 * Pure: no I/O, no `new Date()`, no throwing. A malformed file yields fewer
 * rows, never an exception.
 */

/** Split raw CSV text into rows of cells, honouring quotes and embedded newlines. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;

  // Strip a UTF-8 BOM; Excel adds one and it corrupts the first header cell.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  const pushCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    // Drop rows that are entirely empty — bank exports pad with blank lines.
    if (row.some((c) => c !== '')) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i]!;

    if (quoted) {
      if (ch === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushCell();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // Handle CRLF and a bare CR as one terminator.
      if (text[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }

    cell += ch;
    i += 1;
  }

  // Flush whatever the file ended on, even without a trailing newline.
  if (cell !== '' || row.length > 0) pushRow();

  return rows;
}

/**
 * Guess the delimiter.
 *
 * Some Indian bank exports are tab- or semicolon-separated despite the .csv
 * extension. We score each candidate by how consistently it splits the first
 * few populated lines, because the winner is the one that produces the same
 * column count repeatedly — not merely the most frequent character.
 */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 40);
  if (sample.length === 0) return ',';

  let best = ',';
  let bestScore = -1;

  for (const candidate of [',', '\t', ';', '|']) {
    const counts = sample
      .map((line) => line.split(candidate).length)
      .filter((n) => n > 1);
    if (counts.length === 0) continue;

    // Modal column count, and how many lines agree with it.
    const freq = new Map<number, number>();
    for (const n of counts) freq.set(n, (freq.get(n) ?? 0) + 1);
    let modal = 0;
    let agree = 0;
    for (const [n, f] of freq) {
      if (f > agree || (f === agree && n > modal)) {
        modal = n;
        agree = f;
      }
    }

    // Reward agreement, and reward splitting into more than two columns —
    // a stray semicolon in one narration should not beat a real comma layout.
    const score = agree * 10 + Math.min(modal, 12);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}
