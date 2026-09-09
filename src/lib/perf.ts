/** Fixed-capacity ring buffer for latency samples. */
export class RingBuffer {
  private buf: Float64Array;
  private count = 0;
  private head = 0;

  constructor(capacity: number) {
    this.buf = new Float64Array(capacity);
  }

  push(value: number): void {
    this.buf[this.head] = value;
    this.head = (this.head + 1) % this.buf.length;
    this.count = Math.min(this.count + 1, this.buf.length);
  }

  clear(): void {
    this.count = 0;
    this.head = 0;
  }

  get size(): number {
    return this.count;
  }

  toArray(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.count; i++) {
      out.push(this.buf[(this.head - this.count + i + this.buf.length * 2) % this.buf.length]);
    }
    return out;
  }

  percentile(p: number): number | null {
    if (this.count === 0) return null;
    const sorted = this.toArray().sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
  }

  last(): number | null {
    if (this.count === 0) return null;
    return this.buf[(this.head - 1 + this.buf.length) % this.buf.length];
  }
}

/** Runs `fn` and returns [result, elapsedMs] via performance.now(). */
export function timed<T>(fn: () => T): [T, number] {
  const t0 = performance.now();
  const result = fn();
  return [result, performance.now() - t0];
}

/**
 * Measure a React render pass. Returns a function to call in
 * useLayoutEffect after the commit; returns 0 if no start was recorded.
 */
let pendingRenderStart = 0;
export function markRenderStart(): void {
  pendingRenderStart = performance.now();
}
export function takeRenderMs(): number {
  if (!pendingRenderStart) return 0;
  const ms = performance.now() - pendingRenderStart;
  pendingRenderStart = 0;
  return ms;
}
