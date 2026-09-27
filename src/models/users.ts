import { arr, num, str, strOrNull, type Wire } from './wire.js';

/** Sort field for user lists. */
export const UserSortBy = {
  Id: 'id',
  Email: 'email',
} as const;
export type UserSortBy = (typeof UserSortBy)[keyof typeof UserSortBy];

/** Sort order for user and person lists (lowercase, unlike {@link SortDirection}). */
export const SortOrder = {
  Asc: 'asc',
  Desc: 'desc',
} as const;
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

export interface User {
  uuid: string;
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
}

export interface UserListResponse {
  items: User[];
  page: number;
  perPage: number;
  sortBy: string;
  order: string;
  total: number;
}

export interface UserListOptions {
  page?: number | undefined;
  perPage?: number | undefined;
  sortBy?: UserSortBy | undefined;
  order?: SortOrder | undefined;
}

/** @internal */
export function userFromApi(w: Wire): User {
  return {
    uuid: str(w.uuid),
    id: num(w.id),
    email: str(w.email),
    firstName: strOrNull(w.firstname),
    lastName: strOrNull(w.lastname),
    displayName: strOrNull(w.display_name),
  };
}

/** @internal */
export function userListFromApi(w: Wire): UserListResponse {
  return {
    items: arr(w.items, userFromApi),
    page: num(w.page),
    perPage: num(w.per_page),
    sortBy: str(w.sort_by),
    order: str(w.order),
    total: num(w.total),
  };
}
