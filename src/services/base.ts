import type { HttpClient, RequestOptions } from '../http.js';
import { historyFromApi, type HistoryResponse } from '../models/history.js';
import type { HistoryListOptions } from '../models/list.js';
import type { Wire } from '../models/wire.js';
import { encodeParams } from '../query.js';

/** @internal Shared plumbing for the service classes. */
export abstract class Service {
  constructor(protected readonly http: HttpClient) {}

  protected async fetchHistory<T>(
    path: string,
    map: (w: Wire) => T,
    opts: HistoryListOptions | undefined,
    options: RequestOptions | undefined,
  ): Promise<HistoryResponse<T>> {
    const query = encodeParams({
      page: opts?.page || undefined,
      per_page: opts?.perPage || undefined,
    });
    const w = await this.http.json<Wire>({ method: 'GET', path, query }, options);
    return historyFromApi(w, map);
  }
}

/** @internal Path-escapes a caller-supplied identifier. */
export const seg = (id: string | number): string => encodeURIComponent(String(id));
