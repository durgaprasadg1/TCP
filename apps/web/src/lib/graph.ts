import type { PdaDefinition, TmDefinition } from '@cw/core';
import { pdaTransitionText, tmTransitionText } from './format';

export interface GraphNode {
  id: string;
  start: boolean;
  accepting: boolean;
  rejecting: boolean;
}

export interface GraphEdgeLabel {
  transitionId: string;
  text: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  labels: GraphEdgeLabel[];
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  startId: string;
}

function group(
  transitions: { id: string; from: string; to: string }[],
  text: (index: number) => string,
): GraphEdge[] {
  const map = new Map<string, GraphEdge>();
  transitions.forEach((t, i) => {
    const id = `${t.from}->${t.to}`;
    const edge = map.get(id) ?? { id, source: t.from, target: t.to, labels: [] };
    edge.labels.push({ transitionId: t.id, text: text(i) });
    map.set(id, edge);
  });
  return [...map.values()];
}

/** Builds the diagram model. Transitions that reference unknown states are drawn only if both states exist. */
export function pdaGraph(def: PdaDefinition): Graph {
  const known = new Set(def.states);
  const nodes = def.states.map((s) => ({
    id: s,
    start: s === def.startState,
    accepting: def.acceptanceMode === 'FINAL_STATE' && def.finalStates.includes(s),
    rejecting: false,
  }));
  const valid = def.transitions.filter((t) => known.has(t.from) && known.has(t.to));
  const edges = group(valid, (i) => pdaTransitionText(valid[i] as PdaDefinition['transitions'][number]));
  return { nodes, edges, startId: def.startState };
}

export function tmGraph(def: TmDefinition): Graph {
  const known = new Set(def.states);
  const nodes = def.states.map((s) => ({
    id: s,
    start: s === def.startState,
    accepting: def.acceptStates.includes(s),
    rejecting: def.rejectStates.includes(s),
  }));
  const valid = def.transitions.filter((t) => known.has(t.from) && known.has(t.to));
  const edges = group(valid, (i) => tmTransitionText(valid[i] as TmDefinition['transitions'][number]));
  return { nodes, edges, startId: def.startState };
}

export interface XY {
  x: number;
  y: number;
}

const COL_GAP = 210;
const ROW_GAP = 130;
const BAND_GAP = 250;
const MAX_COLS = 4;

/** Layered layout: BFS depth from the start state decides the column; unreachable states form a last column. */
export function layoutGraph(graph: Graph): Record<string, XY> {
  const layers = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = adjacency.get(e.source) ?? [];
    list.push(e.target);
    adjacency.set(e.source, list);
  }
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (ids.has(graph.startId)) {
    layers.set(graph.startId, 0);
    const queue = [graph.startId];
    for (let h = 0; h < queue.length; h++) {
      const cur = queue[h] as string;
      for (const next of adjacency.get(cur) ?? []) {
        if (!layers.has(next)) {
          layers.set(next, (layers.get(cur) ?? 0) + 1);
          queue.push(next);
        }
      }
    }
  }
  const maxLayer = Math.max(-1, ...layers.values());
  for (const n of graph.nodes) if (!layers.has(n.id)) layers.set(n.id, maxLayer + 1);

  // Halting states go in their own last column so the flow reads left to right.
  const columns = new Map<number, string[]>();
  for (const n of graph.nodes) {
    const l = layers.get(n.id) ?? 0;
    const list = columns.get(l) ?? [];
    list.push(n.id);
    columns.set(l, list);
  }
  // Wrap long chains into bands of MAX_COLS columns so big machines stay readable after fit-to-view.
  const positions: Record<string, XY> = {};
  const layerNumbers = [...columns.keys()].sort((a, b) => a - b);
  const bandHeights = new Map<number, number>();
  for (const layer of layerNumbers) {
    const band = Math.floor(layer / MAX_COLS);
    bandHeights.set(band, Math.max(bandHeights.get(band) ?? 1, columns.get(layer)?.length ?? 1));
  }
  const bandTop = new Map<number, number>();
  let y = 0;
  for (const band of [...bandHeights.keys()].sort((a, b) => a - b)) {
    const h = bandHeights.get(band) ?? 1;
    bandTop.set(band, y + ((h - 1) * ROW_GAP) / 2);
    y += (h - 1) * ROW_GAP + BAND_GAP;
  }
  for (const layer of layerNumbers) {
    const members = columns.get(layer) ?? [];
    const band = Math.floor(layer / MAX_COLS);
    members.forEach((id, i) => {
      positions[id] = {
        x: (layer % MAX_COLS) * COL_GAP,
        y: (bandTop.get(band) ?? 0) + (i - (members.length - 1) / 2) * ROW_GAP,
      };
    });
  }
  return positions;
}
