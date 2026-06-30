import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Text, Line } from "@react-three/drei";
import * as THREE from "three";
import { CellState } from "../cellState";
import type { Implicant } from "../algorithm";
import {
  surfaceSpec,
  makeSurface,
  cellLayouts,
  bandLayouts,
  buildPatch,
  termAssignment,
  type Surface,
  type CellLayout,
} from "../surface";

const FILL: Record<CellState, string> = {
  "1": "#f3b720", // minterm
  "0": "#143247", // maxterm
  x: "#27505d", // don't-care
};
const EMISSIVE: Record<CellState, string> = {
  "1": "#3a2900",
  "0": "#03101b",
  x: "#08191f",
};

// Subdivided patch over a (u,v) rectangle, disposed on unmount. Bounds are
// passed as primitives so the geometry memo stays stable across re-renders.
function Patch({
  surface,
  u0,
  u1,
  v0,
  v1,
  seg,
  offset = 0,
  children,
  ...mesh
}: {
  surface: Surface;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  seg: number;
  offset?: number;
  children: ReactNode;
} & React.ComponentProps<"mesh">) {
  const geom = useMemo(
    () => buildPatch(surface, u0, u1, v0, v1, seg, seg, offset),
    [surface, u0, u1, v0, v1, seg, offset],
  );
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom} {...mesh}>
      {children}
    </mesh>
  );
}

function Cell({
  surface,
  cell,
  state,
  seg,
  onToggle,
  onHover,
}: {
  surface: Surface;
  cell: CellLayout;
  state: CellState;
  seg: number;
  onToggle: (term: number) => void;
  onHover: (h: { term: number; pos: THREE.Vector3 } | null) => void;
}) {
  // Lay the digit flat on the surface (tangent plane), facing outward, kept as
  // upright as world-up allows — so it reads as printed on the shape.
  const { pos, quat, hoverPos } = useMemo(() => {
    const p = surface.point(cell.cu, cell.cv);
    const n = surface.normal(cell.cu, cell.cv).normalize();
    const ref =
      Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(ref, n).normalize();
    const up = new THREE.Vector3().crossVectors(n, right).normalize();
    const m = new THREE.Matrix4().makeBasis(right, up, n);
    return {
      pos: p.clone().addScaledVector(n, 0.025),
      quat: new THREE.Quaternion().setFromRotationMatrix(m),
      hoverPos: p.clone().addScaledVector(n, 0.18),
    };
  }, [surface, cell.cu, cell.cv]);

  return (
    <>
      <Patch
        surface={surface}
        u0={cell.u0}
        u1={cell.u1}
        v0={cell.v0}
        v1={cell.v1}
        seg={seg}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(cell.term);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover({ term: cell.term, pos: hoverPos });
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "auto";
        }}
      >
        <meshStandardMaterial
          color={FILL[state]}
          emissive={EMISSIVE[state]}
          roughness={0.5}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </Patch>
      <Text
        position={pos}
        quaternion={quat}
        fontSize={0.34}
        color={state === "1" ? "#3a2600" : "#cdeee6"}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0}
      >
        {state}
      </Text>
    </>
  );
}

export default function KmapSurface({
  numVars,
  outputs,
  onToggle,
  groups,
  palette,
}: {
  numVars: number;
  outputs: CellState[];
  onToggle: (term: number) => void;
  groups: Implicant[];
  palette: string[];
}) {
  // Overlay visibility follows the panel's SOP/POS/off switch (passed in via
  // `groups`); the 3D view adds no controls of its own beyond the legend.
  const [hover, setHover] = useState<{ term: number; pos: THREE.Vector3 } | null>(
    null,
  );

  const spec = useMemo(() => surfaceSpec(numVars), [numVars]);
  const surfaces = useMemo(
    () => Array.from({ length: spec.halves }, (_, h) => makeSurface(spec, h)),
    [spec],
  );
  const cells = useMemo(() => cellLayouts(spec), [spec]);
  const bands = useMemo(() => bandLayouts(groups, spec), [groups, spec]);
  const seg = spec.topology === "flat" ? 1 : 8;

  // E-adjacency links between the two tori (5 var): one per (row, col).
  const links = useMemo(() => {
    if (spec.halves !== 2) return [];
    return cells
      .filter((c) => c.half === 0)
      .map((c) => ({
        a: surfaces[0].point(c.cu, c.cv),
        b: surfaces[1].point(c.cu, c.cv),
        key: `${c.row}-${c.col}`,
      }));
  }, [cells, surfaces, spec.halves]);

  return (
    <div className="flex w-full flex-col gap-2">
      {/* value legend (the only 3D-view control) */}
      <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-widest text-teal-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-xs bg-[#f3b720]" />1
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-xs bg-[#143247]" />0
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-xs bg-[#27505d]" />x
        </span>
      </div>

      <div className="h-110 w-full overflow-hidden rounded-md border border-teal-800/50 bg-[#0a1722]">
        <Canvas camera={{ position: [5, 3.6, 7.5], fov: 45 }} dpr={[1, 2]}>
          <ambientLight intensity={0.95} />
          <directionalLight position={[5, 8, 6]} intensity={1.1} />
          <directionalLight position={[-6, -3, -5]} intensity={0.4} color="#7cf" />

          {/* solid body, slightly recessed so the cells read as tiles on it */}
          {surfaces.map((surface, h) => (
            <Patch
              key={`base-${h}`}
              surface={surface}
              u0={0}
              u1={1}
              v0={0}
              v1={1}
              seg={seg === 1 ? 1 : 96}
              offset={-0.03}
            >
              <meshStandardMaterial
                color="#0b2030"
                roughness={0.85}
                metalness={0.05}
                side={THREE.DoubleSide}
              />
            </Patch>
          ))}

          {cells.map((cell) => (
            <Cell
              key={`${cell.half}-${cell.row}-${cell.col}`}
              surface={surfaces[cell.half]}
              cell={cell}
              state={outputs[cell.term]}
              seg={seg}
              onToggle={onToggle}
              onHover={setHover}
            />
          ))}

          {bands.map((b, i) => (
            <Patch
              key={`band-${b.groupIndex}-${b.half}-${i}`}
              surface={surfaces[b.half]}
              u0={b.u0}
              u1={b.u1}
              v0={b.v0}
              v1={b.v1}
              seg={seg}
              offset={0.04 + (b.groupIndex % 6) * 0.02}
            >
              <meshBasicMaterial
                color={palette[b.groupIndex % palette.length]}
                transparent
                opacity={0.34}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </Patch>
          ))}

          {links.map((l) => (
            <Line
              key={l.key}
              points={[l.a.toArray(), l.b.toArray()]}
              color="#5eead4"
              lineWidth={1}
              transparent
              opacity={0.35}
            />
          ))}

          {hover && (
            <Html position={hover.pos} center distanceFactor={9} zIndexRange={[100, 0]}>
              <div className="pointer-events-none whitespace-nowrap rounded-sm border border-teal-600/60 bg-[#0a1722]/95 px-2 py-1 text-[0.7rem] text-teal-100">
                <span className="font-bold text-amber-300">m{hover.term}</span>
                <span className="ml-2 text-teal-400">
                  {termAssignment(hover.term, numVars)}
                </span>
              </div>
            </Html>
          )}

          <OrbitControls enablePan={false} minDistance={4} maxDistance={16} />
        </Canvas>
      </div>
    </div>
  );
}
