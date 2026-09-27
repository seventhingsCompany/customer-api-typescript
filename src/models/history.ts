import { arr, num, str, type Wire } from './wire.js';

/** A page of recorded changes, newest first. */
export interface HistoryResponse<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
}

/**
 * A dynamic object history event, kept as returned by the API. Its `type` is
 * asset, task, rental_case or object_merge; merge events carry `user_id` and
 * `absorbedObjectData` instead of `properties`.
 */
export type ObjectHistoryEntry = Record<string, unknown>;

interface HistoryEntryBase {
  userUuid: string;
  occurredAt: string;
  eventName: string;
  description: string;
  /** JSON-encoded snapshot, or an empty string. */
  details: string;
}

export interface RoomHistoryEntry extends HistoryEntryBase {
  roomUuid: string;
}
export interface LocationHistoryEntry extends HistoryEntryBase {
  locationUuid: string;
}
export interface PersonHistoryEntry extends HistoryEntryBase {
  personUuid: string;
}
export interface TaskHistoryEntry extends HistoryEntryBase {
  taskUuid: string;
}
export interface RentalCaseHistoryEntry extends HistoryEntryBase {
  rentalCaseUuid: string;
}

/** @internal Maps a typed entry; subjectKey is e.g. `room_uuid`, subjectProp e.g. `roomUuid`. */
export function historyEntryMapper<K extends string>(
  subjectKey: string,
  subjectProp: K,
): (w: Wire) => HistoryEntryBase & Record<K, string> {
  return (w) =>
    ({
      [subjectProp]: str(w[subjectKey]),
      userUuid: str(w.user_uuid),
      occurredAt: str(w.occurred_at),
      eventName: str(w.event_name),
      description: str(w.description),
      details: str(w.details),
    }) as HistoryEntryBase & Record<K, string>;
}

/** @internal */
export function historyFromApi<T>(w: Wire, map: (item: Wire) => T): HistoryResponse<T> {
  return {
    items: arr(w.items, map),
    page: num(w.page),
    perPage: num(w.per_page),
    total: num(w.total),
  };
}
