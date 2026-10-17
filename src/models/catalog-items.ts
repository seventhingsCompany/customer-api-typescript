import { Fields } from '../fields.js';
import type { SortDirection } from './list.js';
import { arr, num, obj, str, type Wire } from './wire.js';

/**
 * An entry of the product catalog: reusable master data for creating objects.
 * Object field keys carry a `catalog_object_` prefix (e.g.
 * `catalog_object_inventory_name`); catalog metadata such as `id`,
 * `created_at`, `updated_at` and `updated_by_user_id` has none.
 */
export interface CatalogItem {
  uuid: string;
  fields: Fields;
}

/** A page of catalog items. */
export interface CatalogItemListResponse {
  items: CatalogItem[];
  page: number;
  perPage: number;
  total: number;
  /** Sorted field key to direction. */
  sort: Record<string, SortDirection>;
}

/** @internal */
export function catalogItemFromApi(w: Wire): CatalogItem {
  return { uuid: str(w.uuid), fields: new Fields(obj(w.fields) ?? {}) };
}

/** @internal The API sends `[]` instead of `{}` for an empty sort. */
export function catalogItemListFromApi(w: Wire): CatalogItemListResponse {
  return {
    items: arr(w.items, catalogItemFromApi),
    page: num(w.page),
    perPage: num(w.per_page),
    total: num(w.total),
    sort: (obj(w.sort) ?? {}) as Record<string, SortDirection>,
  };
}
