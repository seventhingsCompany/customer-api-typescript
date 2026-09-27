import { uuidFromLocation } from '../helpers.js';
import type { RequestOptions } from '../http.js';
import {
  historyEntryMapper,
  type HistoryResponse,
  type TaskHistoryEntry,
} from '../models/history.js';
import type { HistoryListOptions } from '../models/list.js';
import {
  taskFromApi,
  taskToApi,
  type CreateTask,
  type Task,
  type TaskListOptions,
  type TaskStatus,
  type UpdateTask,
} from '../models/tasks.js';
import type { Wire } from '../models/wire.js';
import { encodeParams } from '../query.js';
import { Service, seg } from './base.js';

const BASE = 'task-management';
const taskHistoryEntry = historyEntryMapper('task_uuid', 'taskUuid');

/** Task management. */
export class TasksService extends Service {
  /** Lists tasks. Not paginated: the API returns up to 10,000 tasks. */
  async list(opts?: TaskListOptions, options?: RequestOptions): Promise<Task[]> {
    const query = encodeParams({
      status: opts?.status,
      deadline_from: opts?.deadlineFrom,
      deadline_to: opts?.deadlineTo,
      assignee: opts?.assignee,
      author: opts?.author,
      reference_type: opts?.referenceType,
    });
    const w = await this.http.json<Wire[]>(
      { method: 'GET', path: `${BASE}/tasks`, query },
      options,
    );
    return (w ?? []).map(taskFromApi);
  }

  /** Creates a task and returns its UUID. */
  async create(input: CreateTask, options?: RequestOptions): Promise<string> {
    const res = await this.http.send(
      { method: 'POST', path: `${BASE}/task`, body: taskToApi(input) },
      options,
    );
    return uuidFromLocation(res.headers);
  }

  async get(uuid: string, options?: RequestOptions): Promise<Task> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `${BASE}/task/${seg(uuid)}` },
      options,
    );
    return taskFromApi(w ?? {});
  }

  /** Replaces the task (PUT): send every field, not just the changed ones. */
  async update(uuid: string, input: UpdateTask, options?: RequestOptions): Promise<void> {
    await this.http.send(
      { method: 'PUT', path: `${BASE}/task/${seg(uuid)}`, body: taskToApi(input) },
      options,
    );
  }

  async delete(uuid: string, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'DELETE', path: `${BASE}/task/${seg(uuid)}` }, options);
  }

  async updateStatus(uuid: string, status: TaskStatus, options?: RequestOptions): Promise<void> {
    await this.http.send(
      { method: 'PUT', path: `${BASE}/task/${seg(uuid)}/status`, body: { status } },
      options,
    );
  }

  /** Recorded changes of the task, newest first. */
  history(
    uuid: string,
    opts?: HistoryListOptions,
    options?: RequestOptions,
  ): Promise<HistoryResponse<TaskHistoryEntry>> {
    return this.fetchHistory(`${BASE}/task/${seg(uuid)}/history`, taskHistoryEntry, opts, options);
  }
}
