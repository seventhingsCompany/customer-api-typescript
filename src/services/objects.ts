import type { ResourceRecord } from '../fields.js';
import type { HttpClient, RequestOptions } from '../http.js';
import {
  fileAttachmentToApi,
  type AttachmentResult,
  type FileAttachment,
} from '../models/files.js';
import type { HistoryResponse, ObjectHistoryEntry } from '../models/history.js';
import type { HistoryListOptions } from '../models/list.js';
import { seg } from './base.js';
import { ResourceService } from './resources.js';

/** Objects (assets). Fields are instance-defined; see `fieldDefinitions` for the `asset` template. */
export class ObjectsService extends ResourceService {
  constructor(http: HttpClient) {
    super(http, 'object', 'objects', false);
  }

  /** Looks up an object by its barcode value. */
  getByBarcode(barcode: string, options?: RequestOptions): Promise<ResourceRecord> {
    return this.http.json<ResourceRecord>(
      { method: 'GET', path: `object/by-barcode/${seg(barcode)}` },
      options,
    );
  }

  /** Updates the given fields; omitted fields are left unchanged. */
  async patch(uuid: string, fields: ResourceRecord, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'PATCH', path: `object/${seg(uuid)}`, body: fields }, options);
  }

  async archive(uuid: string, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'POST', path: `object/${seg(uuid)}/archive` }, options);
  }

  async unarchive(uuid: string, options?: RequestOptions): Promise<void> {
    await this.http.send({ method: 'POST', path: `object/${seg(uuid)}/unarchive` }, options);
  }

  /**
   * Attaches uploaded files to ATTACHMENT fields. Returns the raw result
   * because the API answers 207 Multi-Status when only some attachments succeed.
   */
  addFiles(
    uuid: string,
    attachments: FileAttachment[],
    options?: RequestOptions,
  ): Promise<AttachmentResult> {
    return this.#attachments(uuid, 'add-file', attachments, options);
  }

  /** Detaches files from ATTACHMENT fields. See {@link addFiles} for the result. */
  removeFiles(
    uuid: string,
    attachments: FileAttachment[],
    options?: RequestOptions,
  ): Promise<AttachmentResult> {
    return this.#attachments(uuid, 'remove-file', attachments, options);
  }

  /** Recorded changes of the object, newest first. */
  history(
    uuid: string,
    opts?: HistoryListOptions,
    options?: RequestOptions,
  ): Promise<HistoryResponse<ObjectHistoryEntry>> {
    return this.fetchHistory(`object/${seg(uuid)}/history`, (w) => w, opts, options);
  }

  async #attachments(
    uuid: string,
    action: string,
    attachments: FileAttachment[],
    options?: RequestOptions,
  ): Promise<AttachmentResult> {
    const res = await this.http.send(
      {
        method: 'POST',
        path: `object/${seg(uuid)}/${action}`,
        body: attachments.map(fileAttachmentToApi),
      },
      options,
    );
    return { status: res.status, body: res.json() };
  }
}
