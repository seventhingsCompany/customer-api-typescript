/** Default per-client request limit in requests per minute. */
export const DEFAULT_REQUESTS_PER_MINUTE = 200;

interface Waiter {
  wake: () => void;
}

/**
 * @internal Spaces requests evenly at `requestsPerMinute`, without bursts; the
 * first request is immediate. Waiters are admitted in FIFO order and only the
 * queue head waits for a time slot, so an aborted waiter never consumes one.
 */
export class RateLimiter {
  readonly #intervalMs: number;
  readonly #queue: Waiter[] = [];
  #next = 0;

  constructor(requestsPerMinute: number) {
    this.#intervalMs = 60_000 / requestsPerMinute;
  }

  /** Returns a limiter, or undefined when the limit is zero or less (disabled). */
  static create(requestsPerMinute: number): RateLimiter | undefined {
    return requestsPerMinute > 0 ? new RateLimiter(requestsPerMinute) : undefined;
  }

  /** Resolves when the caller may send. Rejects with the signal's reason when aborted. */
  async wait(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    let wake!: () => void;
    const ready = new Promise<void>((resolve) => (wake = resolve));
    const waiter: Waiter = { wake };
    this.#queue.push(waiter);
    if (this.#queue[0] === waiter) wake();
    try {
      await abortable(ready, signal);
      const delay = this.#next - performance.now();
      if (delay > 0) await sleep(delay, signal);
      this.#next = performance.now() + this.#intervalMs;
    } finally {
      const wasHead = this.#queue[0] === waiter;
      this.#queue.splice(this.#queue.indexOf(waiter), 1);
      if (wasHead) this.#queue[0]?.wake();
    }
  }
}

function abortable(promise: Promise<void>, signal: AbortSignal | undefined): Promise<void> {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, reject);
  });
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
