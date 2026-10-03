import { Semaphore } from './semaphore';

const tick = () => new Promise((r) => setImmediate(r));

describe('Semaphore', () => {
  it('never runs more than `limit` tasks at once and preserves FIFO order', async () => {
    const sem = new Semaphore(2);
    let running = 0;
    let peak = 0;
    const order: number[] = [];
    const releases: Array<() => void> = [];

    const task = (i: number) =>
      sem.run(async () => {
        running++;
        peak = Math.max(peak, running);
        order.push(i);
        await new Promise<void>((resolve) => releases.push(resolve));
        running--;
      });

    const all = Promise.all([task(1), task(2), task(3), task(4)]);
    await tick();
    expect(order).toEqual([1, 2]);
    expect(sem.pending).toBe(2);

    releases.shift()!();
    await tick();
    expect(order).toEqual([1, 2, 3]);

    releases.splice(0).forEach((r) => r());
    await tick();
    releases.splice(0).forEach((r) => r());
    await all;
    expect(peak).toBe(2);
    expect(sem.running).toBe(0);
  });

  it('[AC-GEN-019] releases the slot when the task throws', async () => {
    const sem = new Semaphore(1);
    await expect(
      sem.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(sem.running).toBe(0);
    await expect(sem.run(async () => 42)).resolves.toBe(42);
  });

  it('rejects an invalid limit', () => {
    expect(() => new Semaphore(0)).toThrow();
  });
});
