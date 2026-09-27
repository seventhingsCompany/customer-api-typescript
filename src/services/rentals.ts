import { paginate, uuidFromLocation } from '../helpers.js';
import type { RequestOptions } from '../http.js';
import {
  historyEntryMapper,
  type HistoryResponse,
  type RentalCaseHistoryEntry,
} from '../models/history.js';
import type { HistoryListOptions, ListOptions } from '../models/list.js';
import {
  rentalCaseFromApi,
  rentalCaseToApi,
  type CreateRentalCase,
  type RentalCase,
  type UpdateRentalCase,
} from '../models/rentals.js';
import type { Wire } from '../models/wire.js';
import { encodeListOptions } from '../query.js';
import { Service, seg } from './base.js';

const BASE = 'rental-management';
const rentalCaseHistoryEntry = historyEntryMapper('rental_case_uuid', 'rentalCaseUuid');

/**
 * Rental cases. Requires the rental module on the instance; otherwise calls
 * fail with an ApiError where `isFeatureInactive()` is true.
 */
export class RentalsService extends Service {
  /** Lists one page. */
  async list(opts?: ListOptions, options?: RequestOptions): Promise<RentalCase[]> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `${BASE}/rental-cases`, query: encodeListOptions(opts) },
      options,
    );
    return ((w?.items ?? []) as Wire[]).map(rentalCaseFromApi);
  }

  /** Iterates every rental case across all pages. `opts.page` is ignored; `opts.perPage` defaults to 100. */
  all(opts?: ListOptions, options?: RequestOptions): AsyncGenerator<RentalCase, void, undefined> {
    return paginate(opts?.perPage, (page, perPage) =>
      this.list({ ...opts, page, perPage }, options),
    );
  }

  /** Creates a rental case and returns its UUID. */
  async create(input: CreateRentalCase, options?: RequestOptions): Promise<string> {
    const res = await this.http.send(
      { method: 'POST', path: `${BASE}/rental-case`, body: rentalCaseToApi(input) },
      options,
    );
    return uuidFromLocation(res.headers);
  }

  async get(uuid: string, options?: RequestOptions): Promise<RentalCase> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `${BASE}/rental-case/${seg(uuid)}` },
      options,
    );
    return rentalCaseFromApi(w ?? {});
  }

  /** Replaces the rental case (PUT): send every field, not just the changed ones. */
  async update(uuid: string, input: UpdateRentalCase, options?: RequestOptions): Promise<void> {
    await this.http.send(
      { method: 'PUT', path: `${BASE}/rental-case/${seg(uuid)}`, body: rentalCaseToApi(input) },
      options,
    );
  }

  async delete(uuid: string, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'DELETE', path: `${BASE}/rental-case/${seg(uuid)}` }, options);
  }

  /** Recorded changes of the rental case, newest first. */
  history(
    uuid: string,
    opts?: HistoryListOptions,
    options?: RequestOptions,
  ): Promise<HistoryResponse<RentalCaseHistoryEntry>> {
    return this.fetchHistory(
      `${BASE}/rental-case/${seg(uuid)}/history`,
      rentalCaseHistoryEntry,
      opts,
      options,
    );
  }
}
