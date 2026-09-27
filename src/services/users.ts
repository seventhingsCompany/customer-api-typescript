import { paginate } from '../helpers.js';
import type { RequestOptions } from '../http.js';
import {
  userFromApi,
  userListFromApi,
  type User,
  type UserListOptions,
  type UserListResponse,
} from '../models/users.js';
import type { Wire } from '../models/wire.js';
import { encodeParams } from '../query.js';
import { Service, seg } from './base.js';

/** Login users (read-only). */
export class UsersService extends Service {
  /** Lists one page. */
  async list(opts?: UserListOptions, options?: RequestOptions): Promise<UserListResponse> {
    const query = encodeParams({
      page: opts?.page,
      per_page: opts?.perPage,
      sort_by: opts?.sortBy,
      order: opts?.order,
    });
    const w = await this.http.json<Wire>({ method: 'GET', path: 'users', query }, options);
    return userListFromApi(w ?? {});
  }

  /** Iterates every user across all pages. `opts.page` is ignored; `opts.perPage` defaults to 100. */
  all(opts?: UserListOptions, options?: RequestOptions): AsyncGenerator<User, void, undefined> {
    return paginate(opts?.perPage, async (page, perPage) => {
      const res = await this.list({ ...opts, page, perPage }, options);
      return res.items;
    });
  }

  async get(uuid: string, options?: RequestOptions): Promise<User> {
    const w = await this.http.json<Wire>({ method: 'GET', path: `user/${seg(uuid)}` }, options);
    return userFromApi(w ?? {});
  }

  /** Looks up a user by numeric ID. */
  async getById(id: number, options?: RequestOptions): Promise<User> {
    const w = await this.http.json<Wire>({ method: 'GET', path: `user/by-id/${seg(id)}` }, options);
    return userFromApi(w ?? {});
  }
}
