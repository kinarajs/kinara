import { id } from "../utils/index.js";
import { Query } from "./query.js";
import type { Filter, ModelOptions } from "./types.js";

export function defineModel<T extends Record<string, any>>(options: ModelOptions<T>) {
  const encrypt = options.encrypt ?? [];

  const query = () => new Query<T>(options.collection, encrypt);

  return {
    collection: options.collection,
    query,
    async create(document: Omit<T, "_id"> & { _id?: string }): Promise<T> {
      const row = { _id: document._id ?? id(), ...document } as unknown as T;
      await query().insert(row);
      return row;
    },
    async find(idValue: string): Promise<T | null> {
      return query().where({ _id: idValue }).first();
    },
    async findBy(filter: Filter): Promise<T | null> {
      return query().where(filter).first();
    },
    where(filter: Filter): Query<T> {
      return query().where(filter);
    },
    paginate(page?: number, pageSize?: number) {
      return query().paginate(page, pageSize);
    },
    cursor() {
      return query().cursor();
    },
    toCsv(write: (chunk: string) => void | Promise<void>, columns?: string[]) {
      return query().toCsv(write, columns);
    },
  };
}

export type Model<T extends Record<string, any>> = ReturnType<typeof defineModel<T>>;
