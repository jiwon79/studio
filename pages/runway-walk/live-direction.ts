/** Prepare an edit without pausing the active playback clock. Re-read that
 * clock and displayed history after every asynchronous decode; the initially
 * requested frame may already be in the past when its pixels become ready. */
export async function prepareLiveDirection<T>(options: {
  current(): boolean;
  plan(): T[];
  available(cut: T): boolean;
  prepare(cut: T): Promise<void>;
}): Promise<T[] | undefined> {
  while (options.current()) {
    const sequence = options.plan();
    if (sequence.every(options.available)) return sequence;
    await Promise.all(sequence.map(options.prepare));
  }
}
