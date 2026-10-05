import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Minimal promise-chain mutex. Every task runs after the previous one settled,
 * so read-modify-write cycles on a collection never interleave.
 */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

/**
 * One JSON file per entity collection (an array of records).
 * Reads are served from an in-memory cache; writes go through a per-collection
 * queue and are persisted atomically (write temp file + rename).
 */
export class JsonCollection<T extends { id: string }> {
  private readonly file: string;
  private readonly mutex = new Mutex();
  private cache: T[] | null = null;

  constructor(dataDir: string, name: string) {
    this.file = path.join(dataDir, `${name}.json`);
  }

  private async load(): Promise<T[]> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      this.cache = JSON.parse(raw) as T[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      this.cache = [];
    }
    return this.cache;
  }

  private async persist(items: T[]): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(items, null, 2), 'utf8');
    await fs.rename(tmp, this.file);
    this.cache = items;
  }

  /** Snapshot of all records (copy — mutate only via `update`). */
  async all(): Promise<T[]> {
    return this.mutex.run(async () => structuredClone(await this.load()));
  }

  async find(predicate: (item: T) => boolean): Promise<T[]> {
    return (await this.all()).filter(predicate);
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | undefined> {
    return (await this.all()).find(predicate);
  }

  async get(id: string): Promise<T | undefined> {
    return this.findOne((i) => i.id === id);
  }

  /**
   * Serialized read-modify-write. The mutator receives a working copy and returns
   * the new array plus an arbitrary result value.
   */
  async update<R>(mutator: (items: T[]) => { items: T[]; result: R } | Promise<{ items: T[]; result: R }>): Promise<R> {
    return this.mutex.run(async () => {
      const working = structuredClone(await this.load());
      const { items, result } = await mutator(working);
      await this.persist(items);
      return structuredClone(result);
    });
  }

  async insert(item: T): Promise<T> {
    return this.update((items) => ({ items: [...items, item], result: item }));
  }

  /** Patch one record; returns the updated record or undefined if not found. */
  async patch(id: string, fn: (item: T) => T): Promise<T | undefined> {
    return this.update((items) => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) return { items, result: undefined };
      items[idx] = fn(items[idx]);
      return { items, result: items[idx] };
    });
  }

  async remove(predicate: (item: T) => boolean): Promise<number> {
    return this.update((items) => {
      const kept = items.filter((i) => !predicate(i));
      return { items: kept, result: items.length - kept.length };
    });
  }
}
