import {
  attachmentFileFromApi,
  timeIntervalFromApi,
  type AttachmentFile,
  type TimeInterval,
} from './tasks.js';
import { RentalCaseRenterRequiredError } from '../errors.js';
import { arr, bool, num, obj, str, strOrNull, type Wire } from './wire.js';

export const RentalCaseStatus = {
  Requested: 'requested',
  Confirmed: 'confirmed',
  Borrowed: 'borrowed',
  Rejected: 'rejected',
  Completed: 'completed',
  ReturnOverdue: 'return_overdue',
  PickupOverdue: 'pickup_overdue',
} as const;
export type RentalCaseStatus = (typeof RentalCaseStatus)[keyof typeof RentalCaseStatus];

export const RentalCaseReferenceType = {
  Asset: 'asset',
} as const;
export type RentalCaseReferenceType =
  (typeof RentalCaseReferenceType)[keyof typeof RentalCaseReferenceType];

export const RenterType = {
  /** Free-text renter name. */
  Plain: 'plain',
  /** Renter identified by user UUID. */
  User: 'user',
} as const;
export type RenterType = (typeof RenterType)[keyof typeof RenterType];

export interface RentalCaseRenter {
  type: RenterType;
  value: string;
}

/** A rental case's link to an object, as returned by the API. */
export interface RentalCaseReference {
  type: RentalCaseReferenceType;
  uuid: string;
  name: string;
  id: number;
}

/** A rental case's link to an object, as sent to the API. */
export interface RentalCaseReferenceInput {
  type: RentalCaseReferenceType;
  uuid: string;
}

export interface RentalCase {
  uuid: string;
  status: RentalCaseStatus;
  title: string;
  renter: RentalCaseRenter | null;
  references: RentalCaseReference[];
  /** Whether whole days (UTC) are reserved. Rental cases from before times existed are full-day. */
  isFullDay: boolean;
  /** Pickup time (RFC 3339, UTC); null for a full-day rental case. */
  issueAt: string | null;
  /** Exclusive return time (RFC 3339, UTC); null for a full-day rental case. */
  dueAt: string | null;
  issueDate: string | null;
  issueDateReminder: TimeInterval | null;
  dueDate: string | null;
  dueDateReminder: TimeInterval | null;
  comment: string | null;
  responsibleUserUuid: string | null;
  author: string | null;
  attachments: AttachmentFile[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body for creating a rental case, or the complete replacement state
 * for updating one (PUT, not a partial patch: omitted values may be cleared).
 */
export interface CreateRentalCase {
  /**
   * `true` reserves whole days (UTC) from `issueDate` to `dueDate`; `false`
   * reserves from `issueAt` to `dueAt`. Omit to let `issueAt` and `dueAt`
   * decide: with both the case has times; without them a new case is full-day
   * and an update keeps the stored kind, moving its times to the given dates.
   */
  isFullDay?: boolean | undefined;
  /** Pickup time (RFC 3339, any offset; stored as UTC). Required for a case with times. */
  issueAt?: string | undefined;
  /** Exclusive return time (RFC 3339). Required for a case with times. */
  dueAt?: string | undefined;
  title: string;
  /**
   * Required by the SDK: the API description marks it optional, but the server
   * rejects null and fails when it is omitted. A missing renter throws
   * {@link RentalCaseRenterRequiredError} before any request is sent.
   */
  renter: RentalCaseRenter;
  references?: RentalCaseReferenceInput[] | undefined;
  /** `YYYY-MM-DD`. Derived from `issueAt` for a case with times. */
  issueDate: string;
  issueDateReminder?: TimeInterval | undefined;
  /** `YYYY-MM-DD`. Derived from `dueAt` for a case with times. */
  dueDate: string;
  dueDateReminder?: TimeInterval | undefined;
  comment?: string | undefined;
  responsibleUserUuid: string;
  /** File UUIDs. */
  attachments?: string[] | undefined;
}

export type UpdateRentalCase = CreateRentalCase;

/** @internal */
export function rentalCaseFromApi(w: Wire): RentalCase {
  const renter = obj(w.renter);
  return {
    uuid: str(w.uuid),
    status: w.status,
    title: str(w.title),
    renter: renter ? { type: renter.type, value: str(renter.value) } : null,
    references: arr(w.references, (r) => ({
      type: r.type,
      uuid: str(r.uuid),
      name: str(r.name),
      id: num(r.id),
    })),
    isFullDay: bool(w.is_full_day),
    issueAt: strOrNull(w.issue_at),
    dueAt: strOrNull(w.due_at),
    issueDate: strOrNull(w.issue_date),
    issueDateReminder: timeIntervalFromApi(w.issue_date_reminder),
    dueDate: strOrNull(w.due_date),
    dueDateReminder: timeIntervalFromApi(w.due_date_reminder),
    comment: strOrNull(w.comment),
    responsibleUserUuid: strOrNull(w.responsible_user_uuid),
    author: strOrNull(w.author),
    attachments: arr(w.attachments, attachmentFileFromApi),
    createdAt: str(w.created_at),
    updatedAt: str(w.updated_at),
  };
}

/** @internal Throws RentalCaseRenterRequiredError when the renter is missing. */
export function rentalCaseToApi(r: CreateRentalCase): Wire {
  if (!r.renter) throw new RentalCaseRenterRequiredError();
  const body: Wire = {
    title: r.title,
    renter: r.renter,
    references: r.references ?? [],
    issue_date: r.issueDate,
    due_date: r.dueDate,
    comment: r.comment ?? '',
    responsible_user_uuid: r.responsibleUserUuid,
    attachments: r.attachments ?? [],
  };
  if (r.isFullDay !== undefined) body.is_full_day = r.isFullDay;
  if (r.issueAt !== undefined) body.issue_at = r.issueAt;
  if (r.dueAt !== undefined) body.due_at = r.dueAt;
  if (r.issueDateReminder) body.issue_date_reminder = r.issueDateReminder;
  if (r.dueDateReminder) body.due_date_reminder = r.dueDateReminder;
  return body;
}
