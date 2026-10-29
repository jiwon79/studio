type Job<T> = { index: number; needed: (() => boolean)[]; resolve(value: T | undefined): void; reject(error: unknown): void; promise: Promise<T | undefined> };

/** Bound network concurrency across rapid direction changes. Obsolete queued
 * requests are dropped; shared/in-flight photographs remain reusable. */
export class PhotoDownloads<T> {
  private values = new Map<number, T>();
  private pending = new Map<number, Job<T>>();
  private queue: Job<T>[] = [];
  private active = 0;
  constructor(private fetch: (index: number) => Promise<T>, private downloaded: () => void, private limit = 6) {}
  get size() { return this.values.size; }
  get(index: number) { return this.values.get(index); }
  request(index: number, needed = () => true, priority = true): Promise<T | undefined> {
    const cached = this.values.get(index);
    if (cached !== undefined) return Promise.resolve(cached);
    const existing = this.pending.get(index);
    if (existing) { existing.needed.push(needed); return existing.promise; }
    let resolve!: Job<T>['resolve'], reject!: Job<T>['reject'];
    const promise = new Promise<T | undefined>((accept, fail) => { resolve = accept; reject = fail; });
    const job = { index, needed: [needed], resolve, reject, promise };
    this.pending.set(index, job);
    if (priority) this.queue.unshift(job); else this.queue.push(job);
    this.pump();
    return promise;
  }
  private pump() {
    while (this.active < this.limit && this.queue.length) {
      const job = this.queue.shift()!;
      if (!job.needed.some(check => check())) {
        this.pending.delete(job.index); job.resolve(undefined); continue;
      }
      this.active++;
      void this.fetch(job.index).then(value => {
        this.values.set(job.index, value); this.pending.delete(job.index); this.downloaded(); job.resolve(value);
      }, error => { this.pending.delete(job.index); job.reject(error); }).finally(() => {
        this.active--; this.pump();
      });
    }
  }
}
