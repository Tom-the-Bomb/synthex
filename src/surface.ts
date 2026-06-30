import * as THREE from "three";
import { gray } from "./kmap";
import type { Implicant } from "./algorithm";

export type Topology = "flat" | "cylinder" | "torus" | "twoTorus";

export interface SurfaceSpec {
  topology: Topology;
  cols: number;
  rows: number;
  halves: number;
  colBits: number;
  rowBits: number;
}

export function surfaceSpec(numVars: number): SurfaceSpec {
  switch (numVars) {
    case 1:
      return { topology: "flat", cols: 2, rows: 1, halves: 1, colBits: 1, rowBits: 0 };
    case 2:
      return { topology: "flat", cols: 2, rows: 2, halves: 1, colBits: 1, rowBits: 1 };
    case 3:
      return { topology: "cylinder", cols: 4, rows: 2, halves: 1, colBits: 2, rowBits: 1 };
    case 5:
      return { topology: "twoTorus", cols: 4, rows: 4, halves: 2, colBits: 2, rowBits: 2 };
    default:
      return { topology: "torus", cols: 4, rows: 4, halves: 1, colBits: 2, rowBits: 2 };
  }
}

export function surfaceTerm(
  spec: SurfaceSpec,
  half: number,
  row: number,
  col: number,
): number {
  const eBit = spec.colBits + spec.rowBits;
  return (half << eBit) | (gray(row) << spec.colBits) | gray(col);
}

export function termAssignment(term: number, numVars: number): string {
  const parts = [];
  for (let k = numVars; k >= 1; k--) parts.push(`x${k}=${(term >> (k - 1)) & 1}`);
  return parts.join("  ");
}

export interface Surface {
  point(u: number, v: number): THREE.Vector3;
  normal(u: number, v: number): THREE.Vector3;
}

const TORUS_RADIUS = 2.4;
const TORUS_TUBE = 0.95;
const TORUS_GAP = 1.55;
const CYLINDER_RADIUS = 1.75;
const CYLINDER_HEIGHT = 2.5;
const FLAT_CELL = 1.25;

export function makeSurface(spec: SurfaceSpec, half: number): Surface {
  switch (spec.topology) {
    case "torus":
    case "twoTorus": {
      const yShift = spec.halves === 2 ? (half === 0 ? -TORUS_GAP : TORUS_GAP) : 0;
      return {
        point(u, v) {
          const theta = 2 * Math.PI * u;
          const phi = 2 * Math.PI * v;
          const ring = TORUS_RADIUS + TORUS_TUBE * Math.cos(phi);
          return new THREE.Vector3(
            ring * Math.cos(theta),
            TORUS_TUBE * Math.sin(phi) + yShift,
            ring * Math.sin(theta),
          );
        },
        normal(u, v) {
          const theta = 2 * Math.PI * u;
          const phi = 2 * Math.PI * v;
          return new THREE.Vector3(
            Math.cos(phi) * Math.cos(theta),
            Math.sin(phi),
            Math.cos(phi) * Math.sin(theta),
          ).normalize();
        },
      };
    }
    case "cylinder":
      return {
        point(u, v) {
          const theta = 2 * Math.PI * u;
          return new THREE.Vector3(
            CYLINDER_RADIUS * Math.cos(theta),
            (v - 0.5) * CYLINDER_HEIGHT,
            CYLINDER_RADIUS * Math.sin(theta),
          );
        },
        normal(u) {
          const theta = 2 * Math.PI * u;
          return new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
        },
      };
    default: {
      const width = spec.cols * FLAT_CELL;
      const height = spec.rows * FLAT_CELL;
      return {
        point(u, v) {
          return new THREE.Vector3(u * width - width / 2, v * height - height / 2, 0);
        },
        normal() {
          return new THREE.Vector3(0, 0, 1);
        },
      };
    }
  }
}

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
      const point = surface.point(u, v);
      if (offset !== 0) {
        point.addScaledVector(surface.normal(u, v), offset);
      }
      positions.push(point.x, point.y, point.z);
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// A covered set wraps past the edge, so the run starts at the element whose
// predecessor is missing.
function cyclicRun(set: number[], n: number): { start: number; len: number } {
  if (set.length === n) return { start: 0, len: n };
  const present = new Set(set);
  const start = set.find((x) => !present.has((x - 1 + n) % n))!;
  return { start, len: set.length };
}

const CELL_GAP_U = 0.05;
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
  centerU: number;
  centerV: number;
}

export function cellLayouts(spec: SurfaceSpec): CellLayout[] {
  const du = 1 / spec.cols;
  const dv = 1 / spec.rows;
  const gapU = du * CELL_GAP_U;
  const gapV = dv * CELL_GAP_V;
  const cells: CellLayout[] = [];

  for (let half = 0; half < spec.halves; half++) {
    for (let row = 0; row < spec.rows; row++) {
      for (let col = 0; col < spec.cols; col++) {
        cells.push({
          half,
          row,
          col,
          term: surfaceTerm(spec, half, row, col),
          u0: col * du + gapU,
          u1: (col + 1) * du - gapU,
          v0: row * dv + gapV,
          v1: (row + 1) * dv - gapV,
          centerU: (col + 0.5) * du,
          centerV: (row + 0.5) * dv,
        });
      }
    }
  }
  return cells;
}

export interface BandLayout {
  groupIndex: number;
  half: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export function bandLayouts(groups: Implicant[], spec: SurfaceSpec): BandLayout[] {
  const { cols, rows, colBits, rowBits } = spec;
  const du = 1 / cols;
  const dv = 1 / rows;
  const eBit = colBits + rowBits;
  const lowMask = cols - 1;
  const midMask = (rows - 1) << colBits;
  const bands: BandLayout[] = [];

  groups.forEach((group, groupIndex) => {
    const onesLow = group.ones & lowMask;
    const dashLow = group.dashes & lowMask;
    const onesMid = (group.ones & midMask) >> colBits;
    const dashMid = (group.dashes & midMask) >> colBits;

    const coveredCols: number[] = [];
    for (let col = 0; col < cols; col++) {
      if ((gray(col) & ~dashLow & lowMask) === onesLow) {
        coveredCols.push(col);
      }
    }
    const coveredRows: number[] = [];
    for (let row = 0; row < rows; row++) {
      if ((gray(row) & ~dashMid & (rows - 1)) === onesMid) {
        coveredRows.push(row);
      }
    }

    const eOnes = (group.ones >> eBit) & 1;
    const eDash = (group.dashes >> eBit) & 1;
    const halves =
      spec.halves === 1 ? [0] : [0, 1].filter((h) => eDash === 1 || h === eOnes);

    const colRun = cyclicRun(coveredCols, cols);
    const rowRun = cyclicRun(coveredRows, rows);

    for (const half of halves) {
      bands.push({
        groupIndex,
        half,
        u0: colRun.start * du + du * BAND_GAP,
        u1: (colRun.start + colRun.len) * du - du * BAND_GAP,
        v0: rowRun.start * dv + dv * BAND_GAP,
        v1: (rowRun.start + rowRun.len) * dv - dv * BAND_GAP,
      });
    }
  });

  return bands;
}
