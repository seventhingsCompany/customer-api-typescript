import type { ResourceRecord } from '../fields.js';
import type { HttpClient, RequestOptions } from '../http.js';
import {
  historyEntryMapper,
  type HistoryResponse,
  type LocationHistoryEntry,
} from '../models/history.js';
import type { HistoryListOptions } from '../models/list.js';
import { seg } from './base.js';
import { ResourceService } from './resources.js';

const locationHistoryEntry = historyEntryMapper('location_uuid', 'locationUuid');

/** Locations. Fields are instance-defined. */
export class LocationsService extends ResourceService {
  constructor(http: HttpClient) {
    super(http, 'location', 'locations', true);
  }

  /**
   * Updates the given fields and returns the updated location. The API answers
   * PATCH with an empty body, so the location is re-read in that case.
   */
  async patch(
    uuid: string,
    fields: ResourceRecord,
    options?: RequestOptions,
  ): Promise<ResourceRecord> {
    const res = await this.http.send(
      { method: 'PATCH', path: `location/${seg(uuid)}`, body: fields },
      options,
    );
    const body = res.json<ResourceRecord | undefined>();
    if (!body || Object.keys(body).length === 0) return this.get(uuid, options);
    return this.normalize(body);
  }

  /** Recorded changes of the location, newest first. */
  history(
    uuid: string,
    opts?: HistoryListOptions,
    options?: RequestOptions,
  ): Promise<HistoryResponse<LocationHistoryEntry>> {
    return this.fetchHistory(`location/${seg(uuid)}/history`, locationHistoryEntry, opts, options);
  }
}
