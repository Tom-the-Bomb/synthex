import type { Implicant } from "./algorithm";

export const MAX_KMAP_VARS = 5;
// The truth-table variable cap (the largest function the app will build).
export const MAX_VARS = 8;

// gray code of an index: gray(0,1,2,3,...) = 0 (00), 1 (01), 3 (11), 2 (10), 6 (110), 7 (111), 5 (101), 4 (100), ...
// consecutive indices differ in exactly one bit, which is precisely why adjacent K-map cells differ in a single variable.
export function gray(x: number) {
  return x ^ (x >> 1);
}

export function bin(value: number, bits: number): string {
  return value.toString(2).padStart(bits, "0");
}

export interface KMapDims {
  rows: number;
  cols: number;
  rowBits: number;
  colBits: number;
}

export function kmapDims(numVars: number): KMapDims {
  const colBits = Math.ceil(numVars / 2);
  const rowBits = Math.floor(numVars / 2);
  return { rows: 1 << rowBits, cols: 1 << colBits, rowBits, colBits };
}

// term = gray(row) * (number of columns) + gray(col)
//
// multiplying the binary equiv of the MS graycode part
// by the column count shifts the row bits to the left of the column bits
// i.e. a * c = a << i where c=2^i (where i = # bits/vars per col, c = # cols)
//
export function cellTerm(row: number, col: number, cols: number): number {
  return gray(row) * cols + gray(col);
}

// Indices in [0, count) that an implicant covers along one K-map axis: those
// whose gray code matches the implicant's fixed bits, with dashed bits treated
// as wildcards. `ones`/`dashes` are masked to the axis width internally.
function coveredIndices(count: number, ones: number, dashes: number): number[] {
  const mask = count - 1;
  const target = ones & mask;
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    if ((gray(i) & ~dashes & mask) === target) {
      indices.push(i);
    }
  }
  return indices;
}

export function coveredCells(
  group: Implicant,
  rows: number,
  cols: number,
  colBits: number,
) {
  return {
    rows: coveredIndices(rows, group.ones >> colBits, group.dashes >> colBits),
    cols: coveredIndices(cols, group.ones, group.dashes),
  };
}
