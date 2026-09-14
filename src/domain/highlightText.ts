// Updated 2026-09-14: One Unicode code point counts as one character in both the browser and API.
export const HIGHLIGHT_LIMIT = 50;
export const highlightLength = (value: string) => Array.from(value).length;
export const validHighlight = (value: unknown): value is string | undefined => value === undefined || (typeof value === 'string' && highlightLength(value) <= HIGHLIGHT_LIMIT);
