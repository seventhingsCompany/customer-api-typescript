import { FilterOperator, type ListOptions, type SortSpec } from './models/list.js';

const MULTI_VALUE_OPERATORS: ReadonlySet<string> = new Set([
  FilterOperator.Like,
  FilterOperator.NotLike,
  FilterOperator.In,
  FilterOperator.Nin,
]);

const enc = encodeURIComponent;

function sortEntries(sort: SortSpec): ReadonlyArray<readonly [string, string]> {
  return Array.isArray(sort) ? sort : Object.entries(sort);
}

/**
 * Encodes ListOptions in the PHP deep-object format the API expects, keeping
 * brackets literal: `page=1&per_page=50&sort[name]=ASC&filter[f][eq]=v`.
 * Multi-value operators (like, not_like, in, nin) repeat `filter[f][op][]=v`.
 */
export function encodeListOptions(o: ListOptions | undefined): string {
  if (!o) return '';
  const parts: string[] = [];
  if (o.page) parts.push(`page=${o.page}`);
  if (o.perPage) parts.push(`per_page=${o.perPage}`);
  if (o.sort) {
    for (const [field, dir] of sortEntries(o.sort)) {
      parts.push(`sort[${enc(field)}]=${enc(dir)}`);
    }
  }
  for (const f of o.filters ?? []) {
    const key = `filter[${enc(f.field)}][${f.operator}]`;
    if (MULTI_VALUE_OPERATORS.has(f.operator)) {
      for (const v of f.values) parts.push(`${key}[]=${enc(String(v))}`);
    } else {
      parts.push(`${key}=${enc(String(f.values[0] ?? ''))}`);
    }
  }
  return parts.join('&');
}

/**
 * Encodes flat key/value pairs, skipping undefined and null values.
 * Keys are given in wire (snake_case) form.
 */
export function encodeParams(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    parts.push(`${key}=${enc(String(value))}`);
  }
  return parts.join('&');
}
