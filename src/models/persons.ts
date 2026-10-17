import { Fields } from '../fields.js';
import type { SortOrder } from './users.js';
import { arr, num, numOrNull, str, strOrNull, type Wire } from './wire.js';

/**
 * A person. Person schemas are template-defined and vary per instance: the
 * typed properties cover the common columns, and `fields` holds the complete
 * field map as returned by the API, including custom fields.
 */
export interface Person {
  uuid: string;
  id: number;
  userUuid: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  department: string | null;
  /** ATTACHMENT value: null, [] or an array of file objects. */
  picture: unknown;
  /** ATTACHMENT value: null, [] or an array of file objects. */
  documents: unknown;
  updatedByUserId: number | null;
  updatedAt: string | null;
  createdAt: string | null;
  importedByUserId: number | null;
  importedWithTemplateId: number | null;
  importedAt: string | null;
  createdOnImportWithTemplateId: number | null;
  /** Every field of the person, including instance-defined custom fields. */
  fields: Fields;
}

export interface PersonListResponse {
  items: Person[];
  page: number;
  perPage: number;
  sortBy: string;
  order: string;
  total: number;
}

export interface PersonListOptions {
  page?: number | undefined;
  perPage?: number | undefined;
  /** A person field key (see field definitions for the `person` template). */
  sortBy?: string | undefined;
  order?: SortOrder | undefined;
}

/** @internal Persons are flat maps of template-defined field keys to values. */
export function personFromApi(w: Wire): Person {
  return {
    uuid: str(w.person_uuid),
    id: num(w.id),
    userUuid: str(w.user_uuid),
    email: str(w.email),
    firstName: strOrNull(w.first_name),
    lastName: strOrNull(w.last_name),
    department: strOrNull(w.department),
    picture: w.picture ?? null,
    documents: w.documents ?? null,
    updatedByUserId: numOrNull(w.updated_by_user_id),
    updatedAt: strOrNull(w.updated_at),
    createdAt: strOrNull(w.created_at),
    importedByUserId: numOrNull(w.imported_by_user_id),
    importedWithTemplateId: numOrNull(w.imported_with_template_id),
    importedAt: strOrNull(w.imported_at),
    createdOnImportWithTemplateId: numOrNull(w.created_on_import_with_template_id),
    fields: new Fields(w),
  };
}

/** @internal */
export function personListFromApi(w: Wire): PersonListResponse {
  return {
    items: arr(w.items, personFromApi),
    page: num(w.page),
    perPage: num(w.per_page),
    sortBy: str(w.sort_by),
    order: str(w.order),
    total: num(w.total),
  };
}
