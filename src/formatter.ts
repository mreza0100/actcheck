/**
 * EU drafting-style alphabetic list formatter.
 *
 * Reproduces the regulation's own list grammar used throughout Annex IV:
 *   (a) first item;
 *   (b) second item;
 *   (c) final item.
 *
 * Semicolons between items, a period after the last, lowercase letters in
 * parentheses. Letters past (z) continue as (aa), (bb), (cc), …
 */

export interface FormatOptions {
  /** Join with " " (default) or "\n" for paragraph-style rendering. */
  separator?: " " | "\n";
}

export function formatAlphaList(
  items: ReadonlyArray<string>,
  opts: FormatOptions = {},
): string {
  if (items.length === 0) return "";
  const sep = opts.separator ?? " ";
  const parts: string[] = items.map((raw, i) => {
    const body = stripTrailingPunctuation(raw.trim());
    const terminator = i === items.length - 1 ? "." : ";";
    return `(${alphaLabel(i)}) ${body}${terminator}`;
  });
  return parts.join(sep);
}

/**
 * Convert a zero-based index to lowercase EU-style label:
 *   0 → a, 1 → b, …, 25 → z, 26 → aa, 27 → bb, … 51 → zz, 52 → aaa, …
 */
export function alphaLabel(index: number): string {
  if (index < 0) throw new RangeError("alphaLabel: index must be ≥ 0");
  if (index < 26) return String.fromCharCode(97 + index);
  const cycle = Math.floor(index / 26);
  const letter = String.fromCharCode(97 + (index % 26));
  return letter.repeat(cycle + 1);
}

function stripTrailingPunctuation(s: string): string {
  return s.replace(/[.;,]+$/u, "");
}
