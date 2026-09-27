import { SeventhingsError } from './errors.js';
import type { ResourceRecord } from './fields.js';

/** Page size used by the `all()` iterators when perPage is not set. */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Returns the last path segment of the Location header. Create endpoints answer
 * 201 with the new resource's URL there.
 */
export function uuidFromLocation(headers: Headers): string {
  const loc = headers.get('Location');
  if (!loc) throw new SeventhingsError('missing Location header');
  const path = (loc.split(/[?#]/, 1)[0] ?? '').replace(/\/+$/, '');
  const uuid = path.slice(path.lastIndexOf('/') + 1);
  if (!uuid) throw new SeventhingsError(`empty path in Location header: ${loc}`);
  return uuid;
}

/** File uploads return the new UUID in Location-UUID; older servers only send Location. */
export function uuidFromFileUpload(headers: Headers): string {
  return headers.get('Location-UUID') || uuidFromLocation(headers);
}

/** CircularityHub endpoints return a numeric ID in the Location-Id header. */
export function intFromLocationId(headers: Headers): number {
  const raw = headers.get('Location-Id');
  if (!raw) throw new SeventhingsError('missing Location-Id header');
  if (!/^\s*-?\d+\s*$/.test(raw)) {
    throw new SeventhingsError(`invalid Location-Id header "${raw}"`);
  }
  return Number.parseInt(raw, 10);
}

/**
 * Keeps the flat field-map contract for room/location responses that use a
 * `{uuid, fields}` envelope. Legacy flat maps pass through unchanged.
 */
export function unwrapResourceFields(resource: ResourceRecord): ResourceRecord {
  const { fields, uuid } = resource;
  if (!isRecord(fields) || typeof uuid !== 'string') return resource;
  // Keep the envelope identity available without overwriting custom fields.
  return 'uuid' in fields ? fields : { ...fields, uuid };
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Walks pages until one returns fewer than perPage items. The caller's options
 * are never mutated.
 */
export async function* paginate<T>(
  perPage: number | undefined,
  fetchPage: (page: number, perPage: number) => Promise<T[]>,
): AsyncGenerator<T, void, undefined> {
  const size = perPage && perPage > 0 ? perPage : DEFAULT_PAGE_SIZE;
  for (let page = 1; ; page++) {
    const items = await fetchPage(page, size);
    yield* items;
    if (items.length < size) return;
  }
}
