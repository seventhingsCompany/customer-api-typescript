import { Fields } from '../fields.js';
import type { SortOrder } from './users.js';
import { arr, num, numOrNull, obj, str, strOrNull, type Wire } from './wire.js';

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

/**
 * @internal Accepts flat records and `{uuid, fields}` envelopes, and both the
 * legacy `person_uuid` and the newer `uuid` identifier.
 */
export function personFromApi(w: Wire): Person {
  const inner = obj(w.fields);
  const data: Wire = typeof w.uuid === 'string' && w.uuid !== '' && inner ? inner : w;
  return {
    uuid: str(data.person_uuid) || str(w.uuid),
    id: num(data.id),
    userUuid: str(data.user_uuid),
    email: str(data.email),
    firstName: strOrNull(data.first_name),
    lastName: strOrNull(data.last_name),
    department: strOrNull(data.department),
    picture: data.picture ?? null,
    documents: data.documents ?? null,
    updatedByUserId: numOrNull(data.updated_by_user_id),
    updatedAt: strOrNull(data.updated_at),
    createdAt: strOrNull(data.created_at),
    importedByUserId: numOrNull(data.imported_by_user_id),
    importedWithTemplateId: numOrNull(data.imported_with_template_id),
    importedAt: strOrNull(data.imported_at),
    createdOnImportWithTemplateId: numOrNull(data.created_on_import_with_template_id),
    fields: new Fields(data),
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
