import {
  attachmentFileFromApi,
  timeIntervalFromApi,
  type AttachmentFile,
  type TimeInterval,
} from './tasks.js';
import { arr, num, obj, str, strOrNull, type Wire } from './wire.js';

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

/** Request body for creating or updating (PUT, full replace) a rental case. */
export interface CreateRentalCase {
  title: string;
  renter?: RentalCaseRenter | null | undefined;
  references?: RentalCaseReferenceInput[] | undefined;
  /** `YYYY-MM-DD`. */
  issueDate: string;
  issueDateReminder?: TimeInterval | undefined;
  /** `YYYY-MM-DD`. */
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

/** @internal */
export function rentalCaseToApi(r: CreateRentalCase): Wire {
  const body: Wire = {
    title: r.title,
    renter: r.renter ?? null,
    references: r.references ?? [],
    issue_date: r.issueDate,
    due_date: r.dueDate,
    comment: r.comment ?? '',
    responsible_user_uuid: r.responsibleUserUuid,
    attachments: r.attachments ?? [],
  };
  if (r.issueDateReminder) body.issue_date_reminder = r.issueDateReminder;
  if (r.dueDateReminder) body.due_date_reminder = r.dueDateReminder;
  return body;
}
