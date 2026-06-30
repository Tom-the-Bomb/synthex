// Geometry helpers for the 3D K-map visualizer.
//
// Each surface is parametrised by (u, v) in [0, 1): u runs around the
// columns (Gray-coded), v around the rows. A cell of n variables is a small
// subdivided patch over its (u, v) range, so it curves with the surface and
// 1-bit-apart cells end up physically adjacent — including the edge/corner
// wraps a flat grid hides.
//
// Variable convention matches algorithm.ts: bit k is x_{k+1} (x_1 = LSB).
import * as THREE from "three";
import { gray } from "./kmap";
import type { Implicant } from "./algorithm";

export type Topology = "flat" | "cylinder" | "torus" | "twoTorus";

export interface SurfaceSpec {
  topology: Topology;
  cols: number; // u divisions (Gray columns)
  rows: number; // v divisions (Gray rows)
  halves: number; // 1, or 2 when the 5th variable E splits into two tori
  colBits: number;
  rowBits: number;
}

// Topology per variable count (see the task's topology table).
export function surfaceSpec(numVars: number): SurfaceSpec {
  switch (numVars) {
    case 1:
      return { topology: "flat", cols: 2, rows: 1, halves: 1, colBits: 1, rowBits: 0 };
    case 2:
      return { topology: "flat", cols: 2, rows: 2, halves: 1, colBits: 1, rowBits: 1 };
    case 3:
      return { topology: "cylinder", cols: 4, rows: 2, halves: 1, colBits: 2, rowBits: 1 };
    case 4:
      return { topology: "torus", cols: 4, rows: 4, halves: 1, colBits: 2, rowBits: 2 };
    case 5:
      return { topology: "twoTorus", cols: 4, rows: 4, halves: 2, colBits: 2, rowBits: 2 };
    default:
      return { topology: "torus", cols: 4, rows: 4, halves: 1, colBits: 2, rowBits: 2 };
  }
}

// Minterm index of the cell at (half, row, col). The Gray-coded row/col give the
// low/mid bits; the half (E) is the top bit. Matches cellTerm() for n <= 4.
export function surfaceTerm(
  spec: SurfaceSpec,
  half: number,
  row: number,
  col: number,
): number {
  const ebit = spec.colBits + spec.rowBits;
  return (half << ebit) | (gray(row) << spec.colBits) | gray(col);
}

// Full variable assignment of a term, MSB first: "x3=1 x2=0 x1=1".
export function termAssignment(term: number, numVars: number): string {
  const parts = [];
  for (let k = numVars; k >= 1; k--) parts.push(`x${k}=${(term >> (k - 1)) & 1}`);
  return parts.join("  ");
}

// ---------------------------------------------------------------------------
// Parametric surfaces. Each exposes point(u,v) and the outward normal(u,v).
// ---------------------------------------------------------------------------
export interface Surface {
  point(u: number, v: number): THREE.Vector3;
  normal(u: number, v: number): THREE.Vector3;
}

const TORUS_R = 2.4; // major radius
const TORUS_TUBE = 0.95;
const TORUS_GAP = 1.55; // vertical separation of the two 5-var tori
const CYL_R = 1.75;
const CYL_H = 2.5;
const FLAT_CELL = 1.25; // world size of a flat cell

export function makeSurface(spec: SurfaceSpec, half: number): Surface {
  switch (spec.topology) {
    case "torus":
    case "twoTorus": {
      const yShift = spec.halves === 2 ? (half === 0 ? -TORUS_GAP : TORUS_GAP) : 0;
      return {
        point(u, v) {
          const th = 2 * Math.PI * u;
          const ph = 2 * Math.PI * v;
          const ring = TORUS_R + TORUS_TUBE * Math.cos(ph);
          return new THREE.Vector3(
            ring * Math.cos(th),
            TORUS_TUBE * Math.sin(ph) + yShift,
            ring * Math.sin(th),
          );
        },
        normal(u, v) {
          const th = 2 * Math.PI * u;
          const ph = 2 * Math.PI * v;
          return new THREE.Vector3(
            Math.cos(ph) * Math.cos(th),
            Math.sin(ph),
            Math.cos(ph) * Math.sin(th),
          ).normalize();
        },
      };
    }
    case "cylinder": {
      return {
        point(u, v) {
          const th = 2 * Math.PI * u;
          return new THREE.Vector3(
            CYL_R * Math.cos(th),
            (v - 0.5) * CYL_H,
            CYL_R * Math.sin(th),
          );
        },
        normal(u) {
          const th = 2 * Math.PI * u;
          return new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
        },
      };
    }
    default: {
      // flat plane in the z = 0 surface, centred at the origin
      const w = spec.cols * FLAT_CELL;
      const h = spec.rows * FLAT_CELL;
      return {
        point(u, v) {
          return new THREE.Vector3(u * w - w / 2, v * h - h / 2, 0);
        },
        normal() {
          return new THREE.Vector3(0, 0, 1);
        },
      };
    }
  }
}

// A subdivided patch over the (u,v) rectangle, pushed out along the normal by
// `offset`. u/v may exceed 1 — the periodic surfaces wrap automatically, which
// is what keeps a wrapped group a single contiguous patch.
export function buildPatch(
  surface: Surface,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  segU = 8,
  segV = 8,
  offset = 0,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j <= segV; j++) {
    for (let i = 0; i <= segU; i++) {
      const u = u0 + (u1 - u0) * (i / segU);
      const v = v0 + (v1 - v0) * (j / segV);
      const p = surface.point(u, v);
      if (offset !== 0) p.addScaledVector(surface.normal(u, v), offset);
      positions.push(p.x, p.y, p.z);
    }
  }

  const stride = segU + 1;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// One contiguous cyclic block: covered indices form a run that may wrap past
// the edge, so the run start is the element whose predecessor is missing.
function cyclicRun(set: number[], n: number): { start: number; len: number } {
  if (set.length === n) return { start: 0, len: n };
  const has = new Set(set);
  let start = set[0];
  for (const x of set) {
    if (!has.has((x - 1 + n) % n)) {
      start = x;
      break;
    }
  }
  return { start, len: set.length };
}

// ---------------------------------------------------------------------------
// Cell + group layouts in (u,v) space (with small gaps baked in).
// ---------------------------------------------------------------------------
const CELL_GAP_U = 0.05; // fraction of a cell left as a seam
const CELL_GAP_V = 0.06;
const BAND_GAP = 0.02;

export interface CellLayout {
  half: number;
  row: number;
  col: number;
  term: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  cu: number; // centre
  cv: number;
}

export function cellLayouts(spec: SurfaceSpec): CellLayout[] {
  const du = 1 / spec.cols;
  const dv = 1 / spec.rows;
  const gu = du * CELL_GAP_U;
  const gv = dv * CELL_GAP_V;
  const out: CellLayout[] = [];

  for (let half = 0; half < spec.halves; half++) {
    for (let row = 0; row < spec.rows; row++) {
      for (let col = 0; col < spec.cols; col++) {
        out.push({
          half,
          row,
          col,
          term: surfaceTerm(spec, half, row, col),
          u0: col * du + gu,
          u1: (col + 1) * du - gu,
          v0: row * dv + gv,
          v1: (row + 1) * dv - gv,
          cu: (col + 0.5) * du,
          cv: (row + 0.5) * dv,
        });
      }
    }
  }
  return out;
}

export interface BandLayout {
  groupIndex: number;
  half: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

// Each prime implicant covers a Cartesian block of rows x cols (independent of
// the E half). cyclicRun unwraps it into one (possibly edge-crossing) range, so
// on the wrapped surface the band is a single contiguous patch.
export function bandLayouts(
  groups: Implicant[],
  spec: SurfaceSpec,
): BandLayout[] {
  const { cols, rows, colBits, rowBits } = spec;
  const du = 1 / cols;
  const dv = 1 / rows;
  const ebit = colBits + rowBits;
  const lowMask = cols - 1;
  const midMask = (rows - 1) << colBits;
  const out: BandLayout[] = [];

  groups.forEach((g, gi) => {
    const onesLow = g.ones & lowMask;
    const dashLow = g.dashes & lowMask;
    const onesMid = (g.ones & midMask) >> colBits;
    const dashMid = (g.dashes & midMask) >> colBits;

    const C: number[] = [];
    for (let c = 0; c < cols; c++)
      if ((gray(c) & ~dashLow & lowMask) === onesLow) C.push(c);
    const R: number[] = [];
    for (let r = 0; r < rows; r++)
      if ((gray(r) & ~dashMid & (rows - 1)) === onesMid) R.push(r);

    const eOnes = (g.ones >> ebit) & 1;
    const eDash = (g.dashes >> ebit) & 1;
    const halves =
      spec.halves === 1 ? [0] : [0, 1].filter((h) => eDash === 1 || h === eOnes);

    const cr = cyclicRun(C, cols);
    const rr = cyclicRun(R, rows);

    for (const half of halves) {
      out.push({
        groupIndex: gi,
        half,
        u0: cr.start * du + du * BAND_GAP,
        u1: (cr.start + cr.len) * du - du * BAND_GAP,
        v0: rr.start * dv + dv * BAND_GAP,
        v1: (rr.start + rr.len) * dv - dv * BAND_GAP,
      });
    }
  });

  return out;
}
