import type { CollectionLike, CursorLike, Filter, Projection, SortSpec } from "./types.js";

function compare(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}

function match(document: Record<string, unknown>, filter: Filter): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    const actual = document[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const ops = expected as Record<string, unknown>;
      const operators = Object.keys(ops).filter((op) => op.startsWith("$"));
      if (operators.length === 0 && actual !== expected) return false;
      if ("$in" in ops && !(ops.$in as unknown[]).includes(actual)) return false;
      if ("$ne" in ops && actual === ops.$ne) return false;
      if ("$gt" in ops && compare(actual, ops.$gt) <= 0) return false;
      if ("$gte" in ops && compare(actual, ops.$gte) < 0) return false;
      if ("$lt" in ops && compare(actual, ops.$lt) >= 0) return false;
      if ("$lte" in ops && compare(actual, ops.$lte) > 0) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

class MemoryCursor<T extends Record<string, unknown>> implements CursorLike<T> {
  private projection?: Projection;
  private sortSpec?: SortSpec;
  private limitCount?: number;
  private skipCount = 0;

  constructor(
    private readonly source: T[],
    private readonly filter: Filter
  ) {}

  project(projection: Projection): this {
    this.projection = projection;
    return this;
  }

  sort(sort: SortSpec): this {
    this.sortSpec = sort;
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  skip(n: number): this {
    this.skipCount = n;
    return this;
  }

  private materialize(): T[] {
    let rows = this.source.filter((row) => match(row, this.filter));
    if (this.sortSpec) {
      const entries = Object.entries(this.sortSpec);
      rows = [...rows].sort((a, b) => {
        for (const [key, dir] of entries) {
          if (a[key] === b[key]) continue;
          return compare(a[key], b[key]) * dir;
        }
        return 0;
      });
    }
    if (this.skipCount) rows = rows.slice(this.skipCount);
    if (this.limitCount !== undefined) rows = rows.slice(0, this.limitCount);
    if (!this.projection) return rows.map((row) => ({ ...row }));
    return rows.map((row) => {
      const next = {} as T;
      for (const [key, include] of Object.entries(this.projection!)) {
        if (include) (next as Record<string, unknown>)[key] = row[key];
      }
      return next;
    });
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for (const row of this.materialize()) {
      yield row;
    }
  }

  async toArray(): Promise<T[]> {
    return this.materialize();
  }
}

export class MemoryCollection<T extends Record<string, unknown> = Record<string, unknown>>
  implements CollectionLike<T>
{
  constructor(private readonly rows: T[] = []) {}

  async insertOne(document: T): Promise<{ insertedId: unknown }> {
    this.rows.push({ ...document });
    return { insertedId: document._id ?? document.id };
  }

  async insertMany(documents: T[]): Promise<{ insertedCount: number }> {
    for (const document of documents) this.rows.push({ ...document });
    return { insertedCount: documents.length };
  }

  async findOne(filter: Filter): Promise<T | null> {
    const found = this.rows.find((row) => match(row, filter));
    return found ? { ...found } : null;
  }

  find(filter: Filter = {}): CursorLike<T> {
    return new MemoryCursor(this.rows, filter);
  }

  async updateOne(filter: Filter, update: Record<string, unknown>): Promise<{ matchedCount: number }> {
    const index = this.rows.findIndex((row) => match(row, filter));
    if (index < 0) return { matchedCount: 0 };
    const set = (update.$set as Record<string, unknown>) ?? update;
    this.rows[index] = { ...this.rows[index], ...set } as T;
    return { matchedCount: 1 };
  }

  async deleteOne(filter: Filter): Promise<{ deletedCount: number }> {
    const index = this.rows.findIndex((row) => match(row, filter));
    if (index < 0) return { deletedCount: 0 };
    this.rows.splice(index, 1);
    return { deletedCount: 1 };
  }

  async countDocuments(filter: Filter = {}): Promise<number> {
    return this.rows.filter((row) => match(row, filter)).length;
  }

  all(): T[] {
    return this.rows;
  }
}
