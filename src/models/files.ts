import { num, str, type Wire } from './wire.js';

/** Metadata of a stored file. */
export interface FileInfo {
  uuid: string;
  name: string;
  /** MIME type. */
  type: string;
  /** Size in bytes. */
  size: number;
  creatorId: number;
  createdAt: string;
  dataUri: string;
  thumbnailUri: string;
}

/** Links an uploaded file to an ATTACHMENT field of an object. */
export interface FileAttachment {
  fieldKey: string;
  fileUuid: string;
}

/** Result of adding or removing object attachments. The API answers 200, or 207 on partial success. */
export interface AttachmentResult {
  status: number;
  body: unknown;
}

/** @internal */
export function fileFromApi(w: Wire): FileInfo {
  return {
    uuid: str(w.uuid),
    name: str(w.name),
    type: str(w.type),
    size: num(w.size),
    creatorId: num(w.creator_id),
    createdAt: str(w.created_at),
    dataUri: str(w.data_uri),
    thumbnailUri: str(w.thumbnail_uri),
  };
}

/** @internal */
export function fileAttachmentToApi(a: FileAttachment): Wire {
  return { 'field-key': a.fieldKey, 'file-uuid': a.fileUuid };
}
