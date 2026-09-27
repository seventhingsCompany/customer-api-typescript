import type { ResourceRecord } from '../fields.js';
import { paginate, uuidFromLocation } from '../helpers.js';
import type { RequestOptions } from '../http.js';
import { filterObjectToApi, type FilterObject } from '../models/circularity-hub.js';
import {
  historyEntryMapper,
  type HistoryResponse,
  type PersonHistoryEntry,
} from '../models/history.js';
import type { HistoryListOptions } from '../models/list.js';
import {
  personFromApi,
  personListFromApi,
  type Person,
  type PersonListOptions,
  type PersonListResponse,
} from '../models/persons.js';
import type { Wire } from '../models/wire.js';
import { encodeParams } from '../query.js';
import { Service, seg } from './base.js';

const personHistoryEntry = historyEntryMapper('person_uuid', 'personUuid');

const personQuery = (o: PersonListOptions | undefined) =>
  encodeParams({ page: o?.page, per_page: o?.perPage, sort_by: o?.sortBy, order: o?.order });

/** Persons: people records managed in asset tracking (distinct from login users). */
export class PersonsService extends Service {
  /** Lists one page. */
  async list(opts?: PersonListOptions, options?: RequestOptions): Promise<PersonListResponse> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: 'persons', query: personQuery(opts) },
      options,
    );
    return personListFromApi(w ?? {});
  }

  /** Iterates every person across all pages. `opts.page` is ignored; `opts.perPage` defaults to 100. */
  all(opts?: PersonListOptions, options?: RequestOptions): AsyncGenerator<Person, void, undefined> {
    return paginate(opts?.perPage, async (page, perPage) => {
      const res = await this.list({ ...opts, page, perPage }, options);
      return res.items;
    });
  }

  async count(opts?: PersonListOptions, options?: RequestOptions): Promise<number> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: 'persons/count', query: personQuery(opts) },
      options,
    );
    return Number(w?.count ?? 0);
  }

  async get(uuid: string, options?: RequestOptions): Promise<Person> {
    const w = await this.http.json<Wire>({ method: 'GET', path: `person/${seg(uuid)}` }, options);
    return personFromApi(w ?? {});
  }

  /** Looks up a person by numeric ID. */
  async getById(id: number, options?: RequestOptions): Promise<Person> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `person/by-id/${seg(id)}` },
      options,
    );
    return personFromApi(w ?? {});
  }

  /** Creates a person from a field map (e.g. `{ first_name, last_name, email }`) and returns its UUID. */
  async create(fields: ResourceRecord, options?: RequestOptions): Promise<string> {
    const res = await this.http.send({ method: 'POST', path: 'person', body: { fields } }, options);
    return uuidFromLocation(res.headers);
  }

  /** Updates the given fields; omitted fields are left unchanged. */
  async patch(uuid: string, fields: ResourceRecord, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'PATCH', path: `person/${seg(uuid)}`, body: fields }, options);
  }

  async delete(uuid: string, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'DELETE', path: `person/${seg(uuid)}` }, options);
  }

  /** Creates login users for the persons matching the filter. */
  async createUser(filter: FilterObject, options?: RequestOptions): Promise<void> {
    await this.http.send(
      {
        method: 'POST',
        path: 'persons/create-user',
        body: { filter: filterObjectToApi(filter).filter ?? {} },
      },
      options,
    );
  }

  /** Recorded changes of the person, newest first. */
  history(
    uuid: string,
    opts?: HistoryListOptions,
    options?: RequestOptions,
  ): Promise<HistoryResponse<PersonHistoryEntry>> {
    return this.fetchHistory(`person/${seg(uuid)}/history`, personHistoryEntry, opts, options);
  }
}
