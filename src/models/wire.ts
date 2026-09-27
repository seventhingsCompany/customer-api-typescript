/**
 * @internal Helpers for mapping API (snake_case) payloads to SDK (camelCase)
 * types. Missing or mistyped values fall back to the zero value, mirroring how
 * the Go SDK decodes JSON.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Wire = Record<string, any>;

export const str = (v: unknown): string => (typeof v === 'string' ? v : '');
export const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
export const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
export const numOrNull = (v: unknown): number | null => (typeof v === 'number' ? v : null);
export const bool = (v: unknown): boolean => v === true;

export function arr<T>(v: unknown, map: (item: Wire) => T): T[] {
  return Array.isArray(v) ? v.map((item) => map((item ?? {}) as Wire)) : [];
}

export function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function obj(v: unknown): Wire | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Wire) : null;
}
