export const MAX_KMAP_VARS = 5;

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

export function cellTerm(row: number, col: number, { cols }: KMapDims): number {
  return gray(row) * cols + gray(col);
}
