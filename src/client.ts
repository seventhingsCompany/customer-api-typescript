import {
  HttpClient,
  type ApiResponse,
  type HttpMethod,
  type RequestOptions,
  type Session,
} from './http.js';
import type { PingResponse } from './models/ping.js';
import type { Wire } from './models/wire.js';
import { AuthService } from './services/auth.js';
import { CircularityHubService } from './services/circularity-hub.js';
import { FieldDefinitionsService } from './services/field-definitions.js';
import { FilesService } from './services/files.js';
import { LocationsService } from './services/locations.js';
import { ObjectsService } from './services/objects.js';
import { PersonsService } from './services/persons.js';
import { RentalsService } from './services/rentals.js';
import { ReportsService } from './services/reports.js';
import { RoomsService } from './services/rooms.js';
import { TasksService } from './services/tasks.js';
import { UsersService } from './services/users.js';

export interface ClientOptions {
  /** Base URL of the seventhings instance, e.g. `https://example.seventhings.com`. */
  instanceUrl: string;
  /** Bearer token from an earlier login. */
  token?: string | undefined;
  /** OAuth client ID, used by `auth.refresh`. Set automatically by the login methods. */
  clientId?: string | undefined;
  /** Custom fetch implementation (proxies, testing). Defaults to the global fetch. */
  fetch?: typeof fetch | undefined;
  /** Extra headers sent with every request, e.g. a User-Agent. */
  headers?: Record<string, string> | undefined;
  /** Default per-request timeout in milliseconds. No timeout by default. */
  timeoutMs?: number | undefined;
}

export interface CredentialsOptions extends ClientOptions {
  username: string;
  password: string;
  clientId: string;
}

export interface RawRequest {
  /** Pre-encoded query string without the leading "?". */
  query?: string | undefined;
  /** Sent as JSON. */
  body?: unknown | undefined;
  /** Accept header. Defaults to application/json; null omits it. */
  accept?: string | null | undefined;
  /** Send the bearer token. Defaults to true. */
  authenticated?: boolean | undefined;
}

/**
 * Client for the seventhings Customer API (`{instanceUrl}/customer-api/v1`).
 *
 * ```ts
 * const client = await SeventhingsClient.withCredentials({
 *   instanceUrl: 'https://example.seventhings.com',
 *   username, password, clientId,
 * });
 * for await (const obj of client.objects.all()) console.log(obj.uuid, obj.name);
 * ```
 */
export class SeventhingsClient {
  readonly auth: AuthService;
  readonly objects: ObjectsService;
  readonly rooms: RoomsService;
  readonly locations: LocationsService;
  readonly persons: PersonsService;
  readonly users: UsersService;
  readonly tasks: TasksService;
  readonly rentals: RentalsService;
  readonly fieldDefinitions: FieldDefinitionsService;
  readonly files: FilesService;
  readonly reports: ReportsService;
  readonly circularityHub: CircularityHubService;

  readonly #http: HttpClient;

  constructor(options: ClientOptions) {
    const session: Session = { token: options.token, clientId: options.clientId };
    this.#http = new HttpClient({
      baseUrl: options.instanceUrl.replace(/\/+$/, '') + '/customer-api/v1',
      session,
      fetch: options.fetch,
      headers: options.headers,
      timeoutMs: options.timeoutMs,
    });
    const http = this.#http;
    this.auth = new AuthService(http);
    this.objects = new ObjectsService(http);
    this.rooms = new RoomsService(http);
    this.locations = new LocationsService(http);
    this.persons = new PersonsService(http);
    this.users = new UsersService(http);
    this.tasks = new TasksService(http);
    this.rentals = new RentalsService(http);
    this.fieldDefinitions = new FieldDefinitionsService(http);
    this.files = new FilesService(http);
    this.reports = new ReportsService(http);
    this.circularityHub = new CircularityHubService(http);
  }

  /** Creates a client and logs in with username and password. */
  static async withCredentials(
    options: CredentialsOptions,
    requestOptions?: RequestOptions,
  ): Promise<SeventhingsClient> {
    const { username, password, ...clientOptions } = options;
    const client = new SeventhingsClient(clientOptions);
    await client.auth.login(username, password, options.clientId, requestOptions);
    return client;
  }

  /** Base URL of the API, e.g. `https://example.seventhings.com/customer-api/v1`. */
  get baseUrl(): string {
    return this.#http.baseUrl;
  }

  /** The current bearer token, if any. */
  get token(): string | undefined {
    return this.#http.session.token;
  }

  /** The OAuth client ID of the last login, if any. */
  get clientId(): string | undefined {
    return this.#http.session.clientId;
  }

  /** Replaces the bearer token, e.g. after refreshing it elsewhere. */
  setToken(token: string | undefined): void {
    this.#http.session.token = token;
  }

  /** Checks that the API is reachable. Does not require authentication. */
  async ping(options?: RequestOptions): Promise<PingResponse> {
    const w = await this.#http.json<Wire>(
      { method: 'GET', path: '', authenticated: false },
      options,
    );
    return { status: String(w?.status ?? ''), description: String(w?.description ?? '') };
  }

  /**
   * Sends a raw request to a path relative to the API base URL. An escape hatch
   * for endpoints the SDK does not wrap yet. Throws ApiError for status >= 400.
   */
  request(
    method: HttpMethod,
    path: string,
    request: RawRequest = {},
    options?: RequestOptions,
  ): Promise<ApiResponse> {
    return this.#http.send({ method, path, ...request }, options);
  }
}
