import { uuidFromFileUpload } from '../helpers.js';
import type { RequestOptions } from '../http.js';
import { fileFromApi, type FileInfo } from '../models/files.js';
import type { Wire } from '../models/wire.js';
import { Service, seg } from './base.js';

/** Data accepted by {@link FilesService.upload}. */
export type UploadData = Blob | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>;

export interface UploadOptions extends RequestOptions {
  /** MIME type of the file. Defaults to the Blob's type, else application/octet-stream. */
  contentType?: string | undefined;
}

/** Uploaded files. Attach them to objects with `objects.addFiles`. */
export class FilesService extends Service {
  /** Lists files. Not paginated: the API returns at most 20 files. */
  async list(options?: RequestOptions): Promise<FileInfo[]> {
    const w = await this.http.json<Wire>({ method: 'GET', path: 'files' }, options);
    return ((w?.items ?? []) as Wire[]).map(fileFromApi);
  }

  async get(uuid: string, options?: RequestOptions): Promise<FileInfo> {
    const w = await this.http.json<Wire>({ method: 'GET', path: `file/${seg(uuid)}` }, options);
    return fileFromApi(w ?? {});
  }

  /** Uploads a file (multipart form field `data`) and returns its UUID. */
  async upload(filename: string, data: UploadData, options: UploadOptions = {}): Promise<string> {
    const { contentType, ...requestOptions } = options;
    const blob = await toBlob(data, contentType);
    const form = new FormData();
    form.append('data', blob, filename);
    const res = await this.http.send(
      { method: 'POST', path: 'file', form, accept: null },
      requestOptions,
    );
    return uuidFromFileUpload(res.headers);
  }

  /** Downloads the file's content. */
  async getData(uuid: string, options?: RequestOptions): Promise<Uint8Array> {
    const res = await this.http.send(
      { method: 'GET', path: `file/${seg(uuid)}/data`, accept: null },
      options,
    );
    return res.body;
  }

  /** Downloads the file's thumbnail image. */
  async getThumbnail(uuid: string, options?: RequestOptions): Promise<Uint8Array> {
    const res = await this.http.send(
      { method: 'GET', path: `file/${seg(uuid)}/thumbnail`, accept: null },
      options,
    );
    return res.body;
  }
}

async function toBlob(data: UploadData, contentType: string | undefined): Promise<Blob> {
  if (data instanceof Blob) {
    return contentType && contentType !== data.type
      ? new Blob([data], { type: contentType })
      : data;
  }
  const type = contentType ?? 'application/octet-stream';
  if (data instanceof ReadableStream) {
    return new Blob([await new Response(data).arrayBuffer()], { type });
  }
  return new Blob([data as BlobPart], { type });
}
