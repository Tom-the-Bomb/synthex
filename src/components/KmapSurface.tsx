import { useEffect, useState, type ReactNode } from "react";
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

type Hover = { term: number; pos: THREE.Vector3 } | null;

const FILL: Record<CellState, string> = {
  "1": "#f3b720",
  "0": "#143247",
  x: "#27505d",
};
const EMISSIVE: Record<CellState, string> = {
  "1": "#3a2900",
  "0": "#03101b",
  x: "#08191f",
};

function Patch({
  surface,
  u0,
  u1,
  v0,
  v1,
  seg,
  segU = seg,
  segV = seg,
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
  segU?: number;
  segV?: number;
  offset?: number;
  children: ReactNode;
} & React.ComponentProps<"mesh">) {
  const geometry = buildPatch(surface, u0, u1, v0, v1, segU, segV, offset);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} {...mesh}>
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
  onHover: (hover: Hover) => void;
}) {
  const point = surface.point(cell.centerU, cell.centerV);
  const normal = surface.normal(cell.centerU, cell.centerV).normalize();
  const reference =
    Math.abs(normal.y) > 0.9
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(reference, normal).normalize();
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  const orientation = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right, up, normal),
  );

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
          onHover({
            term: cell.term,
            pos: point.clone().addScaledVector(normal, 0.18),
          });
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
        position={point.clone().addScaledVector(normal, 0.025)}
        quaternion={orientation}
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
  const [hover, setHover] = useState<Hover>(null);

  const spec = surfaceSpec(numVars);
  const surfaces = Array.from({ length: spec.halves }, (_, half) =>
    makeSurface(spec, half),
  );
  const cells = cellLayouts(spec);
  const bands = bandLayouts(groups, spec);
  const seg = spec.topology === "flat" ? 1 : 8;

  const links =
    spec.halves !== 2
      ? []
      : cells
          .filter((cell) => cell.half === 0)
          .map((cell) => ({
            key: `${cell.row}-${cell.col}`,
            start: surfaces[0].point(cell.centerU, cell.centerV),
            end: surfaces[1].point(cell.centerU, cell.centerV),
          }));

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-widest text-teal-400">
        {(["1", "0", "x"] as CellState[]).map((state) => (
          <span key={state} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-xs"
              style={{ backgroundColor: FILL[state] }}
            />
            {state}
          </span>
        ))}
      </div>

      <div className="h-110 w-full overflow-hidden rounded-md border border-teal-800/50 bg-[#0a1722]">
        <Canvas camera={{ position: [5, 3.6, 7.5], fov: 45 }} dpr={[1, 2]}>
          <ambientLight intensity={0.95} />
          <directionalLight position={[5, 8, 6]} intensity={1.1} />
          <directionalLight
            position={[-6, -3, -5]}
            intensity={0.4}
            color="#7cf"
          />

          {surfaces.map((surface, half) => (
            <Patch
              key={`base-${half}`}
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

          {bands.map((band, i) => (
            <Patch
              key={`band-${band.groupIndex}-${band.half}-${i}`}
              surface={surfaces[band.half]}
              u0={band.u0}
              u1={band.u1}
              v0={band.v0}
              v1={band.v1}
              seg={seg}
              segU={seg * Math.max(1, Math.round((band.u1 - band.u0) * spec.cols))}
              segV={seg * Math.max(1, Math.round((band.v1 - band.v0) * spec.rows))}
              offset={0.04 + (band.groupIndex % 6) * 0.02}
            >
              <meshBasicMaterial
                color={palette[band.groupIndex % palette.length]}
                transparent
                opacity={0.34}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </Patch>
          ))}

          {links.map((link) => (
            <Line
              key={link.key}
              points={[link.start.toArray(), link.end.toArray()]}
              color="#5eead4"
              lineWidth={1}
              transparent
              opacity={0.35}
            />
          ))}

          {hover && (
            <Html
              position={hover.pos}
              center
              distanceFactor={9}
              zIndexRange={[100, 0]}
            >
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
