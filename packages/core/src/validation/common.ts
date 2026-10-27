import type { IssueSeverity, ValidationIssue } from '../shared-types';

export function issue(severity: IssueSeverity, code: string, message: string, path?: string): ValidationIssue {
  return path === undefined ? { severity, code, message } : { severity, code, message, path };
}

/** Symbols are single UTF-16 code units (one visible BMP character). */
export function isSingleSymbol(s: string): boolean {
  return s.length === 1;
}

/** Returns the values that occur more than once in `values`. */
export function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dupes.add(v);
    seen.add(v);
  }
  return [...dupes];
}

/** Human-friendly rendering of a symbol for messages ("" becomes ε, blank is shown as given). */
export function show(symbol: string): string {
  return symbol === '' ? 'ε' : `'${symbol}'`;
}
