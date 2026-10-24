/** Keep high-resolution decoded pages bounded while compressed blobs stay reusable. */
export class AtlasPool<T extends { close(): void }> {
  private values = new Map<number, T>();
  private pending = new Map<number, Promise<T>>();
  constructor(private decode: (index: number) => Promise<T>, private limit = 5) {}
  get size() { return this.values.size; }
  get(index: number) {
    const value = this.values.get(index);
    if (value) { this.values.delete(index); this.values.set(index, value); }
    return value;
  }
  async load(index: number): Promise<T> {
    const cached = this.get(index);
    if (cached) return cached;
    const pending = this.pending.get(index);
    if (pending) return pending;
    const job = this.decode(index).then(value => {
      this.values.set(index, value);
      while (this.values.size > this.limit) {
        const first = this.values.entries().next().value!;
        this.values.delete(first[0]); first[1].close();
      }
      return value;
    }).finally(() => this.pending.delete(index));
    this.pending.set(index, job);
    return job;
  }
}
