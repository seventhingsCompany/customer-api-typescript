import type { FilterOperator, SortDirection } from './list.js';
import { bool, num, numOrNull, obj, str, strOrNull, type Wire } from './wire.js';

/**
 * Filter/sort payload for POST-body filter endpoints (suggest-category,
 * persons create-user), e.g. `{ filter: { status: { eq: 'active' } } }`.
 */
export interface FilterObject {
  filter?: Record<string, Partial<Record<FilterOperator, unknown>>> | undefined;
  sort?: Record<string, SortDirection> | undefined;
}

/** Category and price for an object added to the CircularityHub. */
export interface AddObjectEntry {
  category: string;
  price: string;
}

export interface CircularityHubBillingData {
  firstName: string | null;
  lastName: string | null;
  street: string | null;
  houseNumber: string | null;
  zipCode: string | null;
  city: string | null;
}

export interface CircularityHubOrder {
  id: number;
  orderNumber: string;
  createdAt: string;
  userId: number | null;
  totalPrice: number | null;
  completed: boolean;
  cancelled: boolean;
  cancellationReason: string | null;
  billingData: CircularityHubBillingData | null;
  /** Ordered items, kept as returned by the API. */
  articles: Record<string, unknown>[];
}

/** @internal */
export function orderFromApi(w: Wire): CircularityHubOrder {
  const b = obj(w.billing_data);
  return {
    id: num(w.id),
    orderNumber: str(w.order_number),
    createdAt: str(w.created_at),
    userId: numOrNull(w.user_id),
    totalPrice: numOrNull(w.total_price),
    completed: bool(w.completed),
    cancelled: bool(w.cancelled),
    cancellationReason: strOrNull(w.cancellation_reason),
    billingData: b
      ? {
          firstName: strOrNull(b.first_name),
          lastName: strOrNull(b.last_name),
          street: strOrNull(b.street),
          houseNumber: strOrNull(b.house_number),
          zipCode: strOrNull(b.zip_code),
          city: strOrNull(b.city),
        }
      : null,
    articles: Array.isArray(w.articles) ? w.articles : [],
  };
}

/** @internal Omits empty filter/sort like the Go SDK. */
export function filterObjectToApi(f: FilterObject): Wire {
  const body: Wire = {};
  if (f.filter && Object.keys(f.filter).length > 0) body.filter = f.filter;
  if (f.sort && Object.keys(f.sort).length > 0) body.sort = f.sort;
  return body;
}
