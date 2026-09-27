/** Sort direction for {@link ListOptions.sort}. */
export const SortDirection = {
  Asc: 'ASC',
  Desc: 'DESC',
} as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];

/** Comparison operator of a {@link FilterEntry}. */
export const FilterOperator = {
  Eq: 'eq',
  Neq: 'neq',
  Gt: 'gt',
  GtOrNull: 'gt_or_null',
  Gte: 'gte',
  GteOrNull: 'gte_or_null',
  Lt: 'lt',
  LtOrNull: 'lt_or_null',
  Lte: 'lte',
  LteOrNull: 'lte_or_null',
  Like: 'like',
  NotLike: 'not_like',
  In: 'in',
  Nin: 'nin',
} as const;
export type FilterOperator = (typeof FilterOperator)[keyof typeof FilterOperator];

export type FilterValue = string | number | boolean;

/** A single filter condition. Build one with the {@link Filter} helpers. */
export interface FilterEntry {
  field: string;
  operator: FilterOperator;
  values: FilterValue[];
}

const entry = (field: string, operator: FilterOperator, values: FilterValue[]): FilterEntry => ({
  field,
  operator,
  values,
});

/** Constructors for {@link FilterEntry}. */
export const Filter = {
  /** Values equal to value. */
  eq: (field: string, value: FilterValue) => entry(field, FilterOperator.Eq, [value]),
  /** Values not equal to value. */
  neq: (field: string, value: FilterValue) => entry(field, FilterOperator.Neq, [value]),
  /** Values greater than value. */
  gt: (field: string, value: FilterValue) => entry(field, FilterOperator.Gt, [value]),
  /** Values greater than value, or null. */
  gtOrNull: (field: string, value: FilterValue) => entry(field, FilterOperator.GtOrNull, [value]),
  /** Values greater than or equal to value. */
  gte: (field: string, value: FilterValue) => entry(field, FilterOperator.Gte, [value]),
  /** Values greater than or equal to value, or null. */
  gteOrNull: (field: string, value: FilterValue) => entry(field, FilterOperator.GteOrNull, [value]),
  /** Values less than value. */
  lt: (field: string, value: FilterValue) => entry(field, FilterOperator.Lt, [value]),
  /** Values less than value, or null. */
  ltOrNull: (field: string, value: FilterValue) => entry(field, FilterOperator.LtOrNull, [value]),
  /** Values less than or equal to value. */
  lte: (field: string, value: FilterValue) => entry(field, FilterOperator.Lte, [value]),
  /** Values less than or equal to value, or null. */
  lteOrNull: (field: string, value: FilterValue) => entry(field, FilterOperator.LteOrNull, [value]),
  /** Values containing any of the given substrings. */
  like: (field: string, ...values: FilterValue[]) => entry(field, FilterOperator.Like, values),
  /** Values containing none of the given substrings. */
  notLike: (field: string, ...values: FilterValue[]) =>
    entry(field, FilterOperator.NotLike, values),
  /** Values present in the given set. */
  in: (field: string, ...values: FilterValue[]) => entry(field, FilterOperator.In, values),
  /** Values not present in the given set. */
  nin: (field: string, ...values: FilterValue[]) => entry(field, FilterOperator.Nin, values),
};

/**
 * Sort specification. Use an array of `[field, direction]` pairs (or an object,
 * whose insertion order is kept) to sort by several fields in priority order.
 */
export type SortSpec =
  ReadonlyArray<readonly [string, SortDirection]> | Record<string, SortDirection>;

/** Pagination, sorting and filtering for objects, rooms, locations, rentals and CircularityHub lists. */
export interface ListOptions {
  /** 1-based page number. */
  page?: number | undefined;
  perPage?: number | undefined;
  sort?: SortSpec | undefined;
  filters?: FilterEntry[] | undefined;
}

/** Paging for history endpoints. The API defaults to 50 per page and allows at most 200. */
export interface HistoryListOptions {
  page?: number | undefined;
  perPage?: number | undefined;
}

/** Response of the `.../count` endpoints. */
export interface CountResponse {
  count: number;
}
