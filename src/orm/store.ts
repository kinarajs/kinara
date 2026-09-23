import { KinaraError } from "../errors.js";
import type { CollectionLike } from "./types.js";
import { MemoryCollection } from "./memory.js";

const memory = new Map<string, MemoryCollection>();
let resolver: ((name: string) => CollectionLike | Promise<CollectionLike>) | undefined;

export function useCollections(
  next?: (name: string) => CollectionLike | Promise<CollectionLike>
): void {
  resolver = next;
}

export function resetCollections(): void {
  resolver = undefined;
  memory.clear();
}

export async function resolveCollection<T extends Record<string, unknown>>(
  name: string
): Promise<CollectionLike<T>> {
  if (resolver) return resolver(name) as Promise<CollectionLike<T>> | CollectionLike<T>;
  let collection = memory.get(name);
  if (!collection) {
    collection = new MemoryCollection();
    memory.set(name, collection);
  }
  return collection as CollectionLike<T>;
}

export function bindMongoCollections(db: { collection: (name: string) => unknown }): void {
  useCollections((name) => {
    const col = db.collection(name) as CollectionLike;
    if (!col?.find) {
      throw new KinaraError("Mongo database handle does not expose collections.", {
        code: "MONGO_COLLECTION_INVALID",
      });
    }
    return col;
  });
}
