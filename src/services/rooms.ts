import type { ResourceRecord } from '../fields.js';
import type { HttpClient, RequestOptions } from '../http.js';
import {
  historyEntryMapper,
  type HistoryResponse,
  type RoomHistoryEntry,
} from '../models/history.js';
import type { HistoryListOptions } from '../models/list.js';
import { seg } from './base.js';
import { ResourceService } from './resources.js';

const roomHistoryEntry = historyEntryMapper('room_uuid', 'roomUuid');

/** Rooms. Fields are instance-defined; see `fieldDefinitions` for the `room` template. */
export class RoomsService extends ResourceService {
  constructor(http: HttpClient) {
    super(http, 'room', 'rooms', true);
  }

  /**
   * Updates the given fields and returns the updated room. The API answers
   * PATCH with an empty body, so the room is re-read in that case.
   */
  async patch(
    uuid: string,
    fields: ResourceRecord,
    options?: RequestOptions,
  ): Promise<ResourceRecord> {
    const res = await this.http.send(
      { method: 'PATCH', path: `room/${seg(uuid)}`, body: fields },
      options,
    );
    const body = res.json<ResourceRecord | undefined>();
    if (!body || Object.keys(body).length === 0) return this.get(uuid, options);
    return this.normalize(body);
  }

  /** Recorded changes of the room, newest first. */
  history(
    uuid: string,
    opts?: HistoryListOptions,
    options?: RequestOptions,
  ): Promise<HistoryResponse<RoomHistoryEntry>> {
    return this.fetchHistory(`room/${seg(uuid)}/history`, roomHistoryEntry, opts, options);
  }
}
