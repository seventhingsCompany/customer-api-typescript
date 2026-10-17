import type { ResourceRecord } from '../fields.js';
import { paginate, uuidFromLocationUuid } from '../helpers.js';
import type { RequestOptions } from '../http.js';
import {
  catalogItemFromApi,
  catalogItemListFromApi,
  type CatalogItem,
  type CatalogItemListResponse,
} from '../models/catalog-items.js';
import type { ListOptions } from '../models/list.js';
import type { Wire } from '../models/wire.js';
import { encodeListOptions } from '../query.js';
import { Service, seg } from './base.js';

/**
 * The product catalog. Requires the product catalog feature on the instance
 * and the matching rights; otherwise calls fail with a 403 ApiError.
 */
export class CatalogItemsService extends Service {
  /** Lists one page, with filtering and sorting. */
  async list(opts?: ListOptions, options?: RequestOptions): Promise<CatalogItemListResponse> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: 'catalog-items', query: encodeListOptions(opts) },
      options,
    );
    return catalogItemListFromApi(w ?? {});
  }

  /** Iterates every catalog item across all pages. `opts.page` is ignored; `opts.perPage` defaults to 100. */
  all(opts?: ListOptions, options?: RequestOptions): AsyncGenerator<CatalogItem, void, undefined> {
    return paginate(opts?.perPage, async (page, perPage) => {
      const res = await this.list({ ...opts, page, perPage }, options);
      return res.items;
    });
  }

  async get(uuid: string, options?: RequestOptions): Promise<CatalogItem> {
    const w = await this.http.json<Wire>(
      { method: 'GET', path: `catalog-item/${seg(uuid)}` },
      options,
    );
    return catalogItemFromApi(w ?? {});
  }

  /** Creates a catalog item from its field map and returns its UUID. */
  async create(fields: ResourceRecord, options?: RequestOptions): Promise<string> {
    const res = await this.http.send(
      { method: 'POST', path: 'catalog-item', body: { fields } },
      options,
    );
    return uuidFromLocationUuid(res.headers);
  }

  /**
   * Replaces all fields (PUT): fields missing from `fields` are emptied. The
   * server-maintained `id`, `created_at`, `updated_at` and `updated_by_user_id`
   * are ignored, so the fields of a read item may be sent back unchanged.
   * Objects created from the item are not changed.
   */
  async update(uuid: string, fields: ResourceRecord, options?: RequestOptions): Promise<void> {
    await this.http.send(
      { method: 'PUT', path: `catalog-item/${seg(uuid)}`, body: { fields } },
      options,
    );
  }

  /** Deletes a catalog item. Objects created from it stay intact. */
  async delete(uuid: string, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'DELETE', path: `catalog-item/${seg(uuid)}` }, options);
  }
}
