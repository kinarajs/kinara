export type Filter = Record<string, unknown>;
export type SortSpec = Record<string, 1 | -1>;
export type Projection = Record<string, 0 | 1>;

export interface CursorLike<T> {
  project(projection: Projection): CursorLike<T>;
  sort(sort: SortSpec): CursorLike<T>;
  limit(n: number): CursorLike<T>;
  skip(n: number): CursorLike<T>;
  [Symbol.asyncIterator](): AsyncIterator<T>;
  toArray(): Promise<T[]>;
}

export interface CollectionLike<T extends Record<string, unknown> = Record<string, unknown>> {
  insertOne(document: T): Promise<{ insertedId: unknown }>;
  insertMany(documents: T[]): Promise<{ insertedCount: number }>;
  findOne(filter: Filter): Promise<T | null>;
  find(filter?: Filter): CursorLike<T>;
  updateOne(filter: Filter, update: Record<string, unknown>): Promise<{ matchedCount: number }>;
  deleteOne(filter: Filter): Promise<{ deletedCount: number }>;
  countDocuments(filter?: Filter): Promise<number>;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}

export interface CursorPage<T> {
  items: T[];
  next?: string;
  pageSize: number;
}

export interface ModelOptions<T extends Record<string, any> = Record<string, any>> {
  collection: string;
  encrypt?: Array<keyof T & string>;
}
