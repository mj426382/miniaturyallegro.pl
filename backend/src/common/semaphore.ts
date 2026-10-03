/**
 * Minimal FIFO semaphore – caps how many expensive calls (Gemini image generation)
 * run at once across ALL users of this process. Protects the provider quota and
 * keeps one bulk upload from starving everyone else.
 *
 * Note: process-local. Running several API containers multiplies the limit; a
 * shared queue (e.g. BullMQ on Redis) is the next step when scaling out.
 */
export class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Semaphore limit must be a positive integer');
  }

  get pending(): number {
    return this.queue.length;
  }

  get running(): number {
    return this.active;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  private release() {
    const next = this.queue.shift();
    if (next) next();
    else this.active--;
  }
}
