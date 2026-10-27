// drei's Text needs a .woff; without one it fetches a font from a CDN
import labelFont from "@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff?url";
import { Line, OrbitControls, Text, useCursor } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react";
import * as THREE from "three";

import { canvasWell } from "./ui/styles";
import { CellState } from "../lib/cellState";
import { groupColor, type ViewProps } from "../lib/groups";
import { useMediaQuery } from "../lib/media";
import {
  surfaceSpec,
  makeSurface,
  cellLayouts,
  bandLayouts,
  buildPatch,
  termAssignment,
  type BandLayout,
  type CellLayout,
  type Surface,
  type SurfaceSpec,
} from "../lib/surface";
import { cn } from "../lib/utils";

type Tip = { term: number; x: number; y: number } | null;

// Outside React state so hovering re-renders only the tip. Hiding waits a
// frame so moving between cells doesn't blink it.
function createTipStore() {
  let tip: Tip = null;
  let pendingHide = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    get: () => tip,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    show: (next: Tip) => {
      cancelAnimationFrame(pendingHide);
      tip = next;
      emit();
    },
    hide: () => {
      cancelAnimationFrame(pendingHide);
      pendingHide = requestAnimationFrame(() => {
        tip = null;
        emit();
      });
    },
  };
}
type TipStore = ReturnType<typeof createTipStore>;

function HoverTip({ store, numVars }: { store: TipStore; numVars: number }) {
  const tip = useSyncExternalStore(store.subscribe, store.get);
  useCursor(tip !== null);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host || !tip) {
      return;
    }
    const gap = 12;
    const edge = 4;
    const { offsetWidth: tw, offsetHeight: th } = el;
    const { clientWidth: w, clientHeight: h } = host;
    const left =
      tip.x + gap + tw <= w - edge
        ? tip.x + gap
        : Math.max(edge, tip.x - gap - tw);
    const top =
      tip.y - gap - th >= edge
        ? tip.y - gap - th
        : Math.min(h - th - edge, tip.y + gap + 4);
    el.style.transform = `translate(${left}px, ${top}px)`;
  }, [tip]);
  if (!tip) {
    return null;
  }
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute top-0 left-0 z-10 rounded-md bg-tooltip px-3 py-1.5 font-mono text-xs whitespace-nowrap text-tooltip-fg"
    >
      <span className="font-medium">m{tip.term}</span>
      <span className="ml-2 opacity-70">
        {termAssignment(tip.term, numVars)}
      </span>
    </div>
  );
}

interface Scene {
  fill: Record<CellState, string>;
  emissive: Record<CellState, string>;
  text: Record<CellState, string>;
  body: string;
  link: string;
}

// three.js can't read CSS variables, so the amber here mirrors index.css
const SCENES: Record<"dark" | "light", Scene> = {
  dark: {
    fill: { "1": "#f0b429", "0": "#26282e", x: "#40434b" },
    emissive: { "1": "#3a2900", "0": "#0b0c0e", x: "#111215" },
    text: { "1": "#1d1400", "0": "#d6d8dc", x: "#d6d8dc" },
    body: "#141518",
    link: "#8a8f98",
  },
  light: {
    fill: { "1": "#f0b429", "0": "#e8e9ed", x: "#c4c7ce" },
    emissive: { "1": "#1f1500", "0": "#000000", x: "#000000" },
    text: { "1": "#1d1400", "0": "#3b3e45", x: "#3b3e45" },
    body: "#cfd1d7",
    link: "#6c707a",
  },
};

function Patch({
  surface,
  u0,
  u1,
  v0,
  v1,
  segU,
  segV,
  offset = 0,
  children,
  ...mesh
}: {
  surface: Surface;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  segU: number;
  segV: number;
  offset?: number;
  children: ReactNode;
} & ComponentProps<"mesh">) {
  const geometry = buildPatch(surface, u0, u1, v0, v1, segU, segV, offset);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} {...mesh}>
      {children}
    </mesh>
  );
}

type LabelledCell = CellLayout & { label: ReturnType<typeof labelPose> };

function labelPose(surface: Surface, cell: CellLayout) {
  const point = surface.point(cell.centerU, cell.centerV);
  const normal = surface.normal(cell.centerU, cell.centerV).normalize();
  const reference =
    Math.abs(normal.y) > 0.9
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(reference, normal).normalize();
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  return {
    position: point.addScaledVector(normal, 0.025),
    quaternion: new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, up, normal),
    ),
  };
}

function Cell({
  surface,
  cell,
  state,
  scene,
  seg,
  onToggle,
  tips,
}: {
  surface: Surface;
  cell: LabelledCell;
  state: CellState;
  scene: Scene;
  seg: number;
  onToggle: (term: number) => void;
  tips: TipStore;
}) {
  const showTip = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    tips.show({
      term: cell.term,
      x: e.nativeEvent.offsetX,
      y: e.nativeEvent.offsetY,
    });
  };

  return (
    <>
      <Patch
        surface={surface}
        u0={cell.u0}
        u1={cell.u1}
        v0={cell.v0}
        v1={cell.v1}
        segU={seg}
        segV={seg}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(cell.term);
        }}
        onPointerOver={showTip}
        onPointerMove={showTip}
        onPointerOut={tips.hide}
      >
        <meshStandardMaterial
          color={scene.fill[state]}
          emissive={scene.emissive[state]}
          roughness={0.5}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </Patch>
      <Text
        position={cell.label.position}
        quaternion={cell.label.quaternion}
        font={labelFont}
        fontSize={0.34}
        color={scene.text[state]}
      >
        {state}
      </Text>
    </>
  );
}

// forceSinglePass: double-sided transparent meshes otherwise draw twice a frame
function BandMaterial({
  color,
  opacity,
  bias,
}: {
  color: string;
  opacity: number;
  bias: number;
}) {
  return (
    <meshBasicMaterial
      color={color}
      transparent
      opacity={opacity}
      side={THREE.DoubleSide}
      forceSinglePass
      depthWrite={false}
      polygonOffset
      polygonOffsetFactor={bias}
      polygonOffsetUnits={bias}
    />
  );
}

function BandFrame({
  surface,
  band,
  spec,
  seg,
  color,
  emphasis,
  overOnes,
}: {
  surface: Surface;
  band: BandLayout;
  spec: SurfaceSpec;
  seg: number;
  color: string;
  emphasis: "all" | "selected" | "dimmed";
  overOnes: boolean;
}) {
  const edge = emphasis === "selected" ? 0.13 : 0.09;
  const tu = edge / spec.cols;
  const tv = edge / spec.rows;
  const segU = seg * Math.max(1, Math.round((band.u1 - band.u0) * spec.cols));
  const segV = seg * Math.max(1, Math.round((band.v1 - band.v0) * spec.rows));
  // one height for every group; draw order and depth bias separate overlaps
  const offset = 0.012;
  const bias = -1 - (band.groupIndex % 8);
  // [u0, u1, v0, v1]; the first two run along v
  const strips = [
    [band.u0, band.u0 + tu, band.v0, band.v1],
    [band.u1 - tu, band.u1, band.v0, band.v1],
    [band.u0, band.u1, band.v0, band.v0 + tv],
    [band.u0, band.u1, band.v1 - tv, band.v1],
  ];

  return (
    <>
      {!overOnes && (
        <Patch
          surface={surface}
          u0={band.u0}
          u1={band.u1}
          v0={band.v0}
          v1={band.v1}
          segU={segU}
          segV={segV}
          offset={offset}
          renderOrder={1 + band.groupIndex}
        >
          <BandMaterial
            color={color}
            opacity={
              emphasis === "selected"
                ? 0.42
                : emphasis === "dimmed"
                  ? 0.06
                  : 0.26
            }
            bias={bias}
          />
        </Patch>
      )}
      {strips.map(([u0, u1, v0, v1], k) => (
        <Patch
          key={k}
          surface={surface}
          u0={u0}
          u1={u1}
          v0={v0}
          v1={v1}
          segU={k < 2 ? 1 : segU}
          segV={k < 2 ? segV : 1}
          offset={offset}
          renderOrder={20 + band.groupIndex}
        >
          <BandMaterial
            color={color}
            opacity={emphasis === "dimmed" ? 0.4 : 1}
            bias={bias}
          />
        </Patch>
      ))}
    </>
  );
}

function FitCamera({
  position: [x, y, z],
}: {
  position: [number, number, number];
}) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const k = Math.max(1, size.height / size.width);
    camera.position.set(x * k, y * k, z * k);
    invalidate();
  }, [camera, invalidate, size.width, size.height, x, y, z]);
  return null;
}

function sceneShape(numVars: number) {
  const spec = surfaceSpec(numVars);
  const surfaces = Array.from({ length: spec.halves }, (_, half) =>
    makeSurface(spec, half),
  );
  const cells = cellLayouts(spec).map((cell) => ({
    ...cell,
    label: labelPose(surfaces[cell.half], cell),
  }));
  const links =
    spec.halves !== 2
      ? []
      : cells
          .filter((cell) => cell.half === 0)
          .map((cell) => ({
            key: `${cell.row}-${cell.col}`,
            points: [
              surfaces[0].point(cell.centerU, cell.centerV).toArray(),
              surfaces[1].point(cell.centerU, cell.centerV).toArray(),
            ],
          }));

  const flat = spec.topology === "flat";
  const cameraPosition: [number, number, number] = flat
    ? [0.6, 0.6, 5.5]
    : spec.topology === "cylinder"
      ? [3.4, 1.2, 6]
      : [5, 3.6, 7.5];

  return {
    spec,
    surfaces,
    cells,
    links,
    seg: flat ? 1 : 8,
    baseSeg: flat ? 1 : 96,
    cameraPosition,
  };
}

export default function KMapSurface({
  numVars,
  outputs,
  onToggle,
  groups,
  selected,
  isPOS,
}: ViewProps) {
  const [tips] = useState(createTipStore);
  const light = useMediaQuery("(prefers-color-scheme: light)");
  const scene = SCENES[light ? "light" : "dark"];

  // stable identity, or every Patch rebuilds its geometry
  const { spec, surfaces, cells, links, seg, baseSeg, cameraPosition } =
    useMemo(() => sceneShape(numVars), [numVars]);
  const bands = bandLayouts(groups, spec);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-4 font-mono text-xs text-fg-2">
        {Object.values(CellState).map((state) => (
          <span key={state} className="flex items-center gap-1.5">
            <span
              className="inline-block size-3 rounded-[3px] border border-line-2"
              style={{ backgroundColor: scene.fill[state] }}
            />
            {state}
          </span>
        ))}
      </div>

      <div className={cn(canvasWell, "relative w-full overflow-hidden")}>
        {/* overrides OrbitControls' touch-action: none so swipes scroll the page */}
        <Canvas
          className="touch-pan-y!"
          frameloop="demand"
          camera={{ position: cameraPosition, fov: 45 }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.95} />
            <directionalLight position={[5, 8, 6]} intensity={1.1} />
            <directionalLight position={[-6, -3, -5]} intensity={0.35} />

            {surfaces.map((surface, half) => (
              <Patch
                key={`base-${half}`}
                surface={surface}
                u0={0}
                u1={1}
                v0={0}
                v1={1}
                segU={baseSeg}
                segV={baseSeg}
                offset={-0.03}
              >
                <meshStandardMaterial
                  color={scene.body}
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
                scene={scene}
                seg={seg}
                onToggle={onToggle}
                tips={tips}
              />
            ))}

            {bands.map((band) => (
              <BandFrame
                key={band.id}
                surface={surfaces[band.half]}
                band={band}
                spec={spec}
                seg={seg}
                color={groupColor(isPOS, band.groupIndex)}
                overOnes={!isPOS}
                emphasis={
                  selected < 0
                    ? "all"
                    : band.groupIndex === selected
                      ? "selected"
                      : "dimmed"
                }
              />
            ))}

            {links.map((link) => (
              <Line
                key={link.key}
                points={link.points}
                color={scene.link}
                lineWidth={1}
                transparent
                opacity={0.35}
              />
            ))}

            <FitCamera position={cameraPosition} />
            <OrbitControls enablePan={false} minDistance={4} maxDistance={16} />
          </Suspense>
        </Canvas>
        <HoverTip store={tips} numVars={numVars} />
      </div>
    </div>
  );
}
