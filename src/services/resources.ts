import { Fields, type ResourceRecord } from '../fields.js';
import { paginate, unwrapResourceFields, uuidFromLocation } from '../helpers.js';
import type { HttpClient, RequestOptions } from '../http.js';
import { type ListOptions } from '../models/list.js';
import type { Wire } from '../models/wire.js';
import { encodeListOptions } from '../query.js';
import { Service, seg } from './base.js';

/**
 * @internal CRUD shared by the schema-free resources (objects, rooms,
 * locations): list/all/count on `{plural}`, create on `{singular}`, and
 * get/patch/delete on `{singular}/{uuid}`.
 */
export abstract class ResourceService extends Service {
  constructor(
    http: HttpClient,
    protected readonly singular: string,
    protected readonly plural: string,
    private readonly unwrap: boolean,
  ) {
    super(http);
  }

  protected normalize(r: ResourceRecord): ResourceRecord {
    return this.unwrap ? unwrapResourceFields(r) : r;
  }

  /** Lists one page. */
  async list(opts?: ListOptions, options?: RequestOptions): Promise<ResourceRecord[]> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: this.plural, query: encodeListOptions(opts) },
      options,
    );
    return ((w?.items ?? []) as ResourceRecord[]).map((r) => this.normalize(r));
  }

  /**
   * Iterates every record across all pages. `opts.page` is ignored;
   * `opts.perPage` sets the page size (default 100).
   */
  async *all(
    opts?: ListOptions,
    options?: RequestOptions,
  ): AsyncGenerator<Fields, void, undefined> {
    for await (const r of paginate(opts?.perPage, (page, perPage) =>
      this.list({ ...opts, page, perPage }, options),
    )) {
      yield new Fields(r);
    }
  }

  /** Counts records matching the filters. */
  async count(opts?: ListOptions, options?: RequestOptions): Promise<number> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `${this.plural}/count`, query: encodeListOptions(opts) },
      options,
    );
    return Number(w?.count ?? 0);
  }

  /** Creates a record and returns its UUID. */
  async create(fields: ResourceRecord, options?: RequestOptions): Promise<string> {
    const res = await this.http.send(
      { method: 'POST', path: this.singular, body: fields },
      options,
    );
    return uuidFromLocation(res.headers);
  }

  async get(uuid: string, options?: RequestOptions): Promise<ResourceRecord> {
    const w = await this.http.json<ResourceRecord>(
      { method: 'GET', path: `${this.singular}/${seg(uuid)}` },
      options,
    );
    return this.normalize(w);
  }

  async delete(uuid: string, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'DELETE', path: `${this.singular}/${seg(uuid)}` }, options);
  }
}
