import type { TapeModel, TapeSnapshot } from './types';

/** Widest tape window put into a single snapshot; keeps traces of runaway machines small. */
export const MAX_SNAPSHOT_CELLS = 400;

/**
 * Sparse tape: only non-blank cells are stored, so the tape can grow in both directions
 * without allocating an array. Writing the blank symbol deletes the cell.
 */
export class SparseTape {
  private readonly cells = new Map<number, string>();
  /** Bounds of every cell that was ever non-blank (a conservative superset of the current content). */
  private lo = 0;
  private hi = -1;

  constructor(
    readonly blank: string,
    readonly model: TapeModel = 'TWO_WAY_INFINITE',
  ) {}

  static fromInput(input: string, blank: string, model: TapeModel = 'TWO_WAY_INFINITE'): SparseTape {
    const tape = new SparseTape(blank, model);
    for (let i = 0; i < input.length; i++) tape.write(i, input[i] as string);
    return tape;
  }

  read(position: number): string {
    return this.cells.get(position) ?? this.blank;
  }

  write(position: number, symbol: string): void {
    if (symbol === this.blank) {
      this.cells.delete(position);
      return;
    }
    this.cells.set(position, symbol);
    if (this.hi < this.lo) {
      this.lo = position;
      this.hi = position;
    } else {
      if (position < this.lo) this.lo = position;
      if (position > this.hi) this.hi = position;
    }
  }

  /** New head position after moving; honours the tape model. */
  move(head: number, direction: 'L' | 'R' | 'S'): number {
    if (direction === 'R') return head + 1;
    if (direction === 'L') return this.model === 'LEFT_BOUNDED' ? Math.max(0, head - 1) : head - 1;
    return head;
  }

  /** Window covering every non-blank cell and the head (clipped around the head if too wide). */
  snapshot(head: number): TapeSnapshot {
    let lo = this.hi < this.lo ? head : Math.min(this.lo, head);
    let hi = this.hi < this.lo ? head : Math.max(this.hi, head);
    let clippedLeft = false;
    let clippedRight = false;
    if (hi - lo + 1 > MAX_SNAPSHOT_CELLS) {
      const half = Math.floor(MAX_SNAPSHOT_CELLS / 2);
      const newLo = Math.max(lo, head - half);
      const newHi = Math.min(hi, newLo + MAX_SNAPSHOT_CELLS - 1);
      clippedLeft = newLo > lo;
      clippedRight = newHi < hi;
      lo = newLo;
      hi = newHi;
    }
    const cells: string[] = [];
    for (let p = lo; p <= hi; p++) cells.push(this.read(p));
    return { origin: lo, cells, clippedLeft, clippedRight };
  }

  /** Content between the first and last non-blank cell, with inner blanks kept. */
  content(): string {
    if (this.cells.size === 0) return '';
    let min = Infinity;
    let max = -Infinity;
    for (const k of this.cells.keys()) {
      if (k < min) min = k;
      if (k > max) max = k;
    }
    let out = '';
    for (let p = min; p <= max; p++) out += this.read(p);
    return out;
  }
}
