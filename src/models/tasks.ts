import { arr, num, obj, str, strArr, strOrNull, type Wire } from './wire.js';

export const TimeIntervalUnit = {
  Days: 'days',
  Weeks: 'weeks',
  Months: 'months',
  Years: 'years',
} as const;
export type TimeIntervalUnit = (typeof TimeIntervalUnit)[keyof typeof TimeIntervalUnit];

/** A reminder offset or recurring schedule, e.g. `{ unit: 'weeks', value: 2 }`. */
export interface TimeInterval {
  unit: TimeIntervalUnit;
  value: number;
}

/** A file attached to a task or rental case. */
export interface AttachmentFile {
  uuid: string;
  name: string;
  type: string;
  size: number;
  dataUri: string;
  thumbnailUri: string;
}

export const TaskStatus = {
  Open: 'open',
  Closed: 'closed',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskReferenceType = {
  Asset: 'asset',
} as const;
export type TaskReferenceType = (typeof TaskReferenceType)[keyof typeof TaskReferenceType];

export const TaskReferenceStatus = {
  Open: 'open',
  Done: 'done',
} as const;
export type TaskReferenceStatus = (typeof TaskReferenceStatus)[keyof typeof TaskReferenceStatus];

/** A task's link to an object, as returned by the API. */
export interface TaskReference {
  type: TaskReferenceType;
  uuid: string;
  name: string;
  id: number;
  status: TaskReferenceStatus;
}

/** A task's link to an object, as sent to the API. */
export interface TaskReferenceInput {
  type: TaskReferenceType;
  uuid: string;
}

export interface Task {
  uuid: string;
  title: string;
  status: TaskStatus;
  deadline: string | null;
  /** User UUIDs. */
  assignees: string[];
  /** Author user UUID. */
  author: string;
  references: TaskReference[];
  reminders: TimeInterval[];
  recurringSchedule: TimeInterval | null;
  comment: string | null;
  attachments: AttachmentFile[];
  createdAt: string;
  updatedAt: string;
}

/** Request body for creating or updating (PUT, full replace) a task. */
export interface CreateTask {
  title: string;
  /** `YYYY-MM-DD`. */
  deadline?: string | null | undefined;
  /** User UUIDs. */
  assignees?: string[] | undefined;
  references?: TaskReferenceInput[] | undefined;
  reminders?: TimeInterval[] | undefined;
  recurringSchedule?: TimeInterval | null | undefined;
  comment?: string | undefined;
  /** File UUIDs. */
  attachments?: string[] | undefined;
  /** Notify assignees. */
  notify?: boolean | undefined;
}

export type UpdateTask = CreateTask;

/** Filters for task lists. The endpoint is not paginated and returns up to 10,000 tasks. */
export interface TaskListOptions {
  status?: TaskStatus | undefined;
  /** `YYYY-MM-DD`. */
  deadlineFrom?: string | undefined;
  /** `YYYY-MM-DD`. */
  deadlineTo?: string | undefined;
  /** User UUID. */
  assignee?: string | undefined;
  /** User UUID. */
  author?: string | undefined;
  referenceType?: TaskReferenceType | undefined;
}

/** @internal */
export function timeIntervalFromApi(w: unknown): TimeInterval | null {
  const o = obj(w);
  return o ? { unit: o.unit, value: num(o.value) } : null;
}

/** @internal */
export function attachmentFileFromApi(w: Wire): AttachmentFile {
  return {
    uuid: str(w.uuid),
    name: str(w.name),
    type: str(w.type),
    size: num(w.size),
    dataUri: str(w.data_uri),
    thumbnailUri: str(w.thumbnail_uri),
  };
}

/** @internal */
export function taskFromApi(w: Wire): Task {
  return {
    uuid: str(w.uuid),
    title: str(w.title),
    status: w.status,
    deadline: strOrNull(w.deadline),
    assignees: strArr(w.assignees),
    author: str(w.author),
    references: arr(w.references, (r) => ({
      type: r.type,
      uuid: str(r.uuid),
      name: str(r.name),
      id: num(r.id),
      status: r.status,
    })),
    reminders: arr(w.reminders, timeIntervalFromApi).filter((r) => r !== null),
    recurringSchedule: timeIntervalFromApi(w.recurring_schedule),
    comment: strOrNull(w.comment),
    attachments: arr(w.attachments, attachmentFileFromApi),
    createdAt: str(w.created_at),
    updatedAt: str(w.updated_at),
  };
}

/** @internal */
export function taskToApi(t: CreateTask): Wire {
  const body: Wire = {
    title: t.title,
    deadline: t.deadline ?? null,
    assignees: t.assignees ?? [],
    references: t.references ?? [],
    reminders: t.reminders ?? [],
    recurring_schedule: t.recurringSchedule ?? null,
  };
  if (t.comment !== undefined) body.comment = t.comment;
  if (t.attachments !== undefined) body.attachments = t.attachments;
  if (t.notify !== undefined) body.notify = t.notify;
  return body;
}
