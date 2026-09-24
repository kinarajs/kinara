/** Omitted from the JSON. Used when a relation was not already loaded. */
export const MissingValue: unique symbol = Symbol("kinara.missing");

export type Missing = typeof MissingValue;

export interface Resource<T, Extra = undefined> {
  make(record: T | null | undefined, extra?: Extra): Record<string, unknown> | null;
  collection(records: readonly T[] | null | undefined, extra?: Extra): Array<Record<string, unknown> | null>;
}

/**
 * Allow-list a response. The mapper names every field the API may return.
 * `MissingValue` and `undefined` are dropped, so an unloaded relation never
 * becomes a query and never appears in the body.
 */
export function defineResource<T, Extra = undefined>(
  map: (record: T, extra: Extra) => Record<string, unknown>
): Resource<T, Extra> {
  function make(record: T | null | undefined, extra?: Extra): Record<string, unknown> | null {
    if (record == null) return null;
    return compact(map(record, extra as Extra));
  }

  function collection(records: readonly T[] | null | undefined, extra?: Extra) {
    if (!records || records.length === 0) return [];
    const out = new Array<Record<string, unknown> | null>(records.length);
    for (let i = 0; i < records.length; i++) out[i] = make(records[i], extra);
    return out;
  }

  return { make, collection };
}

/** Include `value` only when `condition` is truthy. */
export function when<T>(condition: unknown, value: T): T | Missing {
  return condition ? value : MissingValue;
}

/**
 * Include a relation only when it is already on the record.
 * An ObjectId or id string is not loaded, so this does not populate.
 */
export function whenLoaded<T>(
  record: unknown,
  relation: string,
  present?: (value: unknown) => T
): T | Missing {
  if (!isLoaded(record, relation)) return MissingValue;
  const value = read(record, relation);
  return present ? present(value) : (value as T);
}

/** True when `relation` is a document or embedded object, not an id. */
export function isLoaded(record: unknown, relation: string): boolean {
  if (!record || typeof record !== "object") return false;
  const populated = (record as { populated?: (path: string) => unknown }).populated;
  if (typeof populated === "function") return Boolean(populated.call(record, relation));
  return isDocument(read(record, relation));
}

/** Read one field. Uses a Mongoose getter when present and never calls populate. */
export function read(record: unknown, key: string): unknown {
  if (!record || typeof record !== "object") return undefined;
  const getter = (record as { get?: (name: string) => unknown }).get;
  if (typeof getter === "function") return getter.call(record, key);
  return (record as Record<string, unknown>)[key];
}

function isDocument(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length === 0 || value.every(isDocument);
  if (isId(value)) return false;
  return typeof value === "object";
}

function isId(value: unknown): boolean {
  if (typeof value === "string") return /^[a-f\d]{24}$/i.test(value);
  if (!value || typeof value !== "object") return false;
  const candidate = value as { _bsontype?: string; toHexString?: () => string; constructor?: { name?: string } };
  return candidate._bsontype === "ObjectId" || (candidate.constructor?.name === "ObjectId" && typeof candidate.toHexString === "function");
}

function compact(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    const value = fields[key];
    if (value === MissingValue || value === undefined) continue;
    out[key] = value;
  }
  return out;
}
