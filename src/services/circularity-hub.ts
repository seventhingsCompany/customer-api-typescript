import { Fields, type ResourceRecord } from '../fields.js';
import { intFromLocationId, paginate } from '../helpers.js';
import type { RequestOptions } from '../http.js';
import {
  filterObjectToApi,
  orderFromApi,
  type AddObjectEntry,
  type CircularityHubOrder,
  type FilterObject,
} from '../models/circularity-hub.js';
import type { ListOptions } from '../models/list.js';
import type { Wire } from '../models/wire.js';
import { encodeListOptions } from '../query.js';
import { Service, seg } from './base.js';

const BASE = 'circularity-hub';

/** CircularityHub (resale of objects). Items and orders use numeric IDs, not UUIDs. */
export class CircularityHubService extends Service {
  /**
   * Suggests a category per matching object (object UUID → category).
   * Returns null when there are no suggestions.
   */
  suggestCategory(
    filter: FilterObject,
    options?: RequestOptions,
  ): Promise<Record<string, string> | null> {
    return this.#suggest('suggest-category', filterObjectToApi(filter), options);
  }

  /**
   * Suggests a rest price per object, given object UUID → category.
   * Returns null when there are no suggestions.
   */
  suggestRestPrice(
    categories: Record<string, string>,
    options?: RequestOptions,
  ): Promise<Record<string, string> | null> {
    return this.#suggest('suggest-rest-price', categories, options);
  }

  /** Adds objects (keyed by object UUID) to the CircularityHub. */
  async addObjects(
    entries: Record<string, AddObjectEntry>,
    options?: RequestOptions,
  ): Promise<void> {
    await this.http.send(
      { method: 'POST', path: `${BASE}/add-objects-to-circularity-hub`, body: entries },
      options,
    );
  }

  /** Lists one page of items. */
  async listItems(opts?: ListOptions, options?: RequestOptions): Promise<ResourceRecord[]> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `${BASE}/items`, query: encodeListOptions(opts) },
      options,
    );
    return (w?.items ?? []) as ResourceRecord[];
  }

  /** Iterates every item across all pages. `opts.page` is ignored; `opts.perPage` defaults to 100. */
  async *allItems(
    opts?: ListOptions,
    options?: RequestOptions,
  ): AsyncGenerator<Fields, void, undefined> {
    for await (const item of paginate(opts?.perPage, (page, perPage) =>
      this.listItems({ ...opts, page, perPage }, options),
    )) {
      yield new Fields(item);
    }
  }

  async getItem(id: number, options?: RequestOptions): Promise<ResourceRecord> {
    return this.http.json<ResourceRecord>(
      { method: 'GET', path: `${BASE}/item/${seg(id)}` },
      options,
    );
  }

  async updateItem(id: number, fields: ResourceRecord, options?: RequestOptions): Promise<void> {
    await this.http.send(
      { method: 'PATCH', path: `${BASE}/item/${seg(id)}`, body: fields },
      options,
    );
  }

  async deleteItem(id: number, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'DELETE', path: `${BASE}/item/${seg(id)}` }, options);
  }

  async listOrders(opts?: ListOptions, options?: RequestOptions): Promise<CircularityHubOrder[]> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `${BASE}/orders`, query: encodeListOptions(opts) },
      options,
    );
    return ((w?.items ?? []) as Wire[]).map(orderFromApi);
  }

  /** Creates an order for the given item IDs and returns the order ID. */
  async createOrder(itemIds: number[], options?: RequestOptions): Promise<number> {
    const res = await this.http.send(
      { method: 'POST', path: `${BASE}/orders`, body: itemIds },
      options,
    );
    return intFromLocationId(res.headers);
  }

  async getOrder(id: number, options?: RequestOptions): Promise<CircularityHubOrder> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `${BASE}/order/${seg(id)}` },
      options,
    );
    return orderFromApi(w ?? {});
  }

  async updateOrder(id: number, fields: ResourceRecord, options?: RequestOptions): Promise<void> {
    await this.http.send(
      { method: 'PATCH', path: `${BASE}/order/${seg(id)}`, body: fields },
      options,
    );
  }

  async #suggest(
    action: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<Record<string, string> | null> {
    const w = await this.http.json<unknown>(
      { method: 'POST', path: `${BASE}/${action}`, body },
      options,
    );
    // The API sends [] rather than {} when there are no suggestions.
    if (w == null || Array.isArray(w)) return null;
    return w as Record<string, string>;
  }
}
