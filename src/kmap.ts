// Geometry helpers shared by the K-map and truth-table views.
//
// A boolean function of `n` variables has 2^n input combinations ("terms"),
// indexed 0 .. 2^n - 1. The `outputs` array is indexed by that term number.
//
// Variable naming matches algorithm.ts: x_{k} corresponds to bit (k - 1),
// so x_1 is the least-significant bit and x_n the most-significant.

export const MAX_KMAP_VARS = 5;

// gray code: consecutive values differ in exactly one bit, which is why
// adjacent K-map cells differ in a single variable.
export function gray(x: number): number {
  return x ^ (x >> 1);
}

export function bin(value: number, bits: number): string {
  return value.toString(2).padStart(bits, "0");
}

export interface KMapDims {
  rows: number; // 2^rowBits
  cols: number; // 2^colBits
  rowBits: number; // high bits of the term -> variables x_n .. x_{colBits+1}
  colBits: number; // low bits of the term  -> variables x_{colBits} .. x_1
}

// Split the variables into a (near) square grid. The column gray code holds the
// low bits and the row gray code the high bits, matching `gridToTerms` in
// algorithm.ts: term = gray(row) * cols + gray(col).
export function kmapDims(numVars: number): KMapDims {
  const colBits = Math.ceil(numVars / 2);
  const rowBits = Math.floor(numVars / 2);
  return { rows: 1 << rowBits, cols: 1 << colBits, rowBits, colBits };
}

// The term number sitting in K-map cell (row, col).
export function cellTerm(
  row: number,
  col: number,
  { cols }: KMapDims,
): number {
  return gray(row) * cols + gray(col);
}
