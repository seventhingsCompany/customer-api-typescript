/**
 * A schema-free resource as returned by the API (objects, rooms, locations,
 * CircularityHub items). Keys are the instance's field keys.
 */
export type ResourceRecord = Record<string, unknown>;

// `YYYY-MM-DD` with an optional ` HH:mm:ss`.
const DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/;
const UUID_KEYS = ['uuid', 'asset_uuid', 'room_uuid', 'location_uuid', 'person_uuid'];
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/i;

function utc(match: RegExpExecArray): Date | undefined {
  const [y = 0, mo = 0, d = 0, h = 0, mi = 0, sec = 0] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, sec));
  // Reject overflowed values such as 2024-02-31.
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return undefined;
  return date;
}

/**
 * Typed read access to a schema-free resource. Objects, rooms, locations and
 * CircularityHub items have instance-defined fields, so the SDK returns them as
 * plain records; wrap one in `Fields` to read values without casts.
 *
 * Every getter returns `undefined` when the key is absent, null, or holds a
 * different type.
 */
export class Fields {
  constructor(readonly data: Record<string, unknown>) {}

  /** The raw value for key. */
  raw(key: string): unknown {
    return this.data[key];
  }

  /** Reports whether key is present with a non-null value. */
  has(key: string): boolean {
    const v = this.data[key];
    return v !== undefined && v !== null;
  }

  string(key: string): string | undefined {
    const v = this.data[key];
    return typeof v === 'string' ? v : undefined;
  }

  number(key: string): number | undefined {
    const v = this.data[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  }

  /** Like {@link number}, but only for integral values. */
  int(key: string): number | undefined {
    const v = this.number(key);
    return v !== undefined && Number.isInteger(v) ? v : undefined;
  }

  bool(key: string): boolean | undefined {
    const v = this.data[key];
    return typeof v === 'boolean' ? v : undefined;
  }

  /**
   * Parses the value as a date. Accepts `YYYY-MM-DD` and `YYYY-MM-DD HH:mm:ss`
   * (both read as UTC) and RFC 3339 timestamps.
   */
  time(key: string): Date | undefined {
    const s = this.string(key);
    if (!s) return undefined;
    const m = DATETIME.exec(s);
    if (m) return utc(m);
    if (RFC3339.test(s)) {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  }

  /**
   * The record's UUID, or "" if absent. Reads "uuid", falling back to the
   * resource-specific keys the API uses (asset_uuid, room_uuid,
   * location_uuid, person_uuid).
   */
  get uuid(): string {
    for (const key of UUID_KEYS) {
      const v = this.string(key);
      if (v) return v;
    }
    return '';
  }

  /** The "name" field, or "" if absent. */
  get name(): string {
    return this.string('name') ?? '';
  }

  toJSON(): Record<string, unknown> {
    return this.data;
  }
}
