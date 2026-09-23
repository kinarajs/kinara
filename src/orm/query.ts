import { withSpan } from "../telemetry/otel.js";
import { decryptDocument, encryptDocument } from "../crypto/fields.js";
import { writeCsv } from "./csv.js";
import { resolveCollection } from "./store.js";
import type { CollectionLike, CursorPage, Filter, Page, Projection, SortSpec } from "./types.js";

export class Query<T extends Record<string, any> = Record<string, any>> {
  private filter: Filter = {};
  private projection?: Projection;
  private sortSpec?: SortSpec;
  private limitCount?: number;
  private skipCount = 0;

  constructor(
    private readonly collectionName: string,
    private readonly encryptFields: string[] = []
  ) {}

  where(filter: Filter): this {
    this.filter = { ...this.filter, ...filter };
    return this;
  }

  select(fields: Array<keyof T & string> | Projection): this {
    if (Array.isArray(fields)) {
      this.projection = Object.fromEntries(fields.map((field) => [field, 1])) as Projection;
    } else {
      this.projection = fields;
    }
    return this;
  }

  orderBy(sort: SortSpec): this {
    this.sortSpec = sort;
    return this;
  }

  take(n: number): this {
    this.limitCount = n;
    return this;
  }

  skip(n: number): this {
    this.skipCount = n;
    return this;
  }

  private async collection(): Promise<CollectionLike<T>> {
    return resolveCollection<T>(this.collectionName);
  }

  private decode(document: T | null): T | null {
    if (!document) return document;
    return decryptDocument(document, this.encryptFields);
  }

  private encode(document: T): T {
    return encryptDocument(document, this.encryptFields);
  }

  private applyCursor(cursor: {
    project(p: Projection): unknown;
    sort(s: SortSpec): unknown;
    limit(n: number): unknown;
    skip(n: number): unknown;
  }): void {
    if (this.projection) cursor.project(this.projection);
    if (this.sortSpec) cursor.sort(this.sortSpec);
    if (this.skipCount) cursor.skip(this.skipCount);
    if (this.limitCount !== undefined) cursor.limit(this.limitCount);
  }

  async *cursor(): AsyncGenerator<T> {
    const collection = await this.collection();
    const native = collection.find(this.filter);
    this.applyCursor(native);
    for await (const document of native) {
      const decoded = this.decode(document);
      if (decoded) yield decoded;
    }
  }

  async first(): Promise<T | null> {
    return withSpan("orm.first", async (span) => {
      span.setAttribute?.("orm.collection", this.collectionName);
      const collection = await this.collection();
      const native = collection.find(this.filter);
      this.applyCursor(native);
      native.limit(1);
      for await (const document of native) {
        return this.decode(document);
      }
      return null;
    });
  }

  async paginate(page = 1, pageSize = 20): Promise<Page<T>> {
    return withSpan("orm.paginate", async (span) => {
      const safePage = Math.max(1, page);
      const safeSize = Math.min(200, Math.max(1, pageSize));
      span.setAttribute?.("orm.collection", this.collectionName);
      span.setAttribute?.("orm.page", safePage);
      const collection = await this.collection();
      const total = await collection.countDocuments(this.filter);
      const native = collection.find(this.filter);
      if (this.projection) native.project(this.projection);
      native.sort(this.sortSpec ?? { _id: 1 });
      native.skip((safePage - 1) * safeSize);
      native.limit(safeSize);
      const items: T[] = [];
      for await (const document of native) {
        const decoded = this.decode(document);
        if (decoded) items.push(decoded);
      }
      return {
        items,
        page: safePage,
        pageSize: safeSize,
        total,
        pages: Math.max(1, Math.ceil(total / safeSize)),
      };
    });
  }

  async cursorPaginate(pageSize = 20, after?: string): Promise<CursorPage<T>> {
    const safeSize = Math.min(200, Math.max(1, pageSize));
    const collection = await this.collection();
    const filter = after ? { ...this.filter, _id: { $gt: after } } : this.filter;
    const native = collection.find(filter);
    if (this.projection) native.project(this.projection);
    native.sort({ _id: 1 });
    native.limit(safeSize + 1);
    const items: T[] = [];
    for await (const document of native) {
      const decoded = this.decode(document);
      if (decoded) items.push(decoded);
    }
    const next = items.length > safeSize ? String(items[safeSize - 1]?._id ?? items[safeSize - 1]?.id) : undefined;
    if (items.length > safeSize) items.pop();
    return { items, next, pageSize: safeSize };
  }

  async toCsv(write: (chunk: string) => void | Promise<void>, columns?: string[]): Promise<number> {
    return withSpan("orm.csv", async (span) => {
      span.setAttribute?.("orm.collection", this.collectionName);
      return writeCsv(this.cursor(), write, columns);
    });
  }

  async insert(document: T): Promise<T> {
    const collection = await this.collection();
    const encoded = this.encode(document);
    await collection.insertOne(encoded);
    return document;
  }

  async insertMany(documents: T[]): Promise<number> {
    if (documents.length === 0) return 0;
    const collection = await this.collection();
    const encoded = documents.map((document) => this.encode(document));
    const result = await collection.insertMany(encoded);
    return result.insertedCount;
  }

  async update(values: Partial<T>): Promise<number> {
    const collection = await this.collection();
    const encoded = this.encode({ ...(values as T) });
    const result = await collection.updateOne(this.filter, { $set: encoded });
    return result.matchedCount;
  }

  async destroy(): Promise<number> {
    const collection = await this.collection();
    const result = await collection.deleteOne(this.filter);
    return result.deletedCount;
  }

  async count(): Promise<number> {
    const collection = await this.collection();
    return collection.countDocuments(this.filter);
  }
}
