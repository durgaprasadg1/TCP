import { Background, BackgroundVariant, Controls, EdgeLabelRenderer, Handle, Position, ReactFlow } from '@xyflow/react';
import type { Edge, EdgeProps, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { memo, useMemo } from 'react';
import { cn } from '../lib/cn';
import { layoutGraph } from '../lib/graph';
import type { Graph } from '../lib/graph';

const R = 28; // node radius

interface StateNodeData extends Record<string, unknown> {
  label: string;
  start: boolean;
  accepting: boolean;
  rejecting: boolean;
  current: boolean;
}

const StateNode = memo(function StateNode({ data }: NodeProps<Node<StateNodeData>>) {
  return (
    <div
      className={cn(
        'relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-[#DED6C1] text-center font-mono text-[11px] font-semibold leading-tight text-[#302d26]',
        data.current && data.rejecting ? 'border-[#9B3939] bg-[#F3DEDA] shadow-[0_0_0_5px_rgba(155,57,57,0.28)]' : data.current ? 'border-[#514b40] bg-[#CFC6B1] shadow-[0_0_0_4px_rgba(81,75,64,0.22)]' : data.rejecting ? 'border-[#9B3939]' : data.accepting ? 'border-[#356448]' : 'border-[#8E8777]',
      )}
      title={`${data.label}${data.start ? ' (start)' : ''}${data.accepting ? ' (accepting)' : ''}${data.rejecting ? ' (rejecting)' : ''}`}
    >
      {(data.accepting || data.rejecting) && (
        <span className={cn('pointer-events-none absolute inset-[3px] rounded-full border', data.accepting ? 'border-[#356448]' : 'border-[#9B3939]')} />
      )}
      {data.start && (
        <span className="pointer-events-none absolute -left-6 top-1/2 -translate-y-1/2 text-base text-slate-400" aria-hidden>
          ▶
        </span>
      )}
      <span className="max-w-[44px] break-all">{data.label}</span>
      <Handle type="target" position={Position.Top} className="cw-handle" />
      <Handle type="source" position={Position.Top} className="cw-handle" />
    </div>
  );
});

interface TransitionEdgeData extends Record<string, unknown> {
  labels: { transitionId: string; text: string }[];
  activeTransitionId: string | null;
  curve: number; // 0 = straight; otherwise signed bend for bidirectional pairs
  selfLoop: boolean;
}

function arrow(x: number, y: number, dx: number, dy: number, color: string) {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const s = 9;
  const p1 = `${x},${y}`;
  const p2 = `${x - ux * s + uy * (s / 2.2)},${y - uy * s - ux * (s / 2.2)}`;
  const p3 = `${x - ux * s - uy * (s / 2.2)},${y - uy * s + ux * (s / 2.2)}`;
  return <polygon points={`${p1} ${p2} ${p3}`} fill={color} />;
}

const TransitionEdge = memo(function TransitionEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps<Edge<TransitionEdgeData>>) {
  if (!data) return null;
  const active = data.activeTransitionId !== null && data.labels.some((l) => l.transitionId === data.activeTransitionId);
  const color = active ? '#514b40' : '#8E8777';
  let path: string;
  let head: JSX.Element;
  let lx: number;
  let ly: number;

  if (data.selfLoop) {
    const cx = sourceX;
    const cy = sourceY;
    const sx = cx - 14;
    const sy = cy - (R - 3);
    const ex = cx + 14;
    const ey = cy - (R - 3);
    path = `M ${sx} ${sy} C ${cx - 42} ${cy - 92}, ${cx + 42} ${cy - 92}, ${ex} ${ey}`;
    head = arrow(ex, ey, 14 - 42 + 28, 30, color);
    lx = cx;
    ly = cy - 78;
  } else {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const nx = -uy;
    const ny = ux;
    const bend = data.curve;
    const mx = (sourceX + targetX) / 2 + nx * bend;
    const my = (sourceY + targetY) / 2 + ny * bend;
    // Start and end on the circle borders, along the direction towards the control point.
    const dirS = Math.hypot(mx - sourceX, my - sourceY) || 1;
    const dirT = Math.hypot(mx - targetX, my - targetY) || 1;
    const sx = sourceX + ((mx - sourceX) / dirS) * R;
    const sy = sourceY + ((my - sourceY) / dirS) * R;
    const ex = targetX + ((mx - targetX) / dirT) * (R + 2);
    const ey = targetY + ((my - targetY) / dirT) * (R + 2);
    path = bend === 0 ? `M ${sx} ${sy} L ${ex} ${ey}` : `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
    head = arrow(ex, ey, ex - (bend === 0 ? sx : mx), ey - (bend === 0 ? sy : my), color);
    lx = bend === 0 ? (sx + ex) / 2 : 0.25 * sx + 0.5 * mx + 0.25 * ex;
    ly = bend === 0 ? (sy + ey) / 2 : 0.25 * sy + 0.5 * my + 0.25 * ey;
  }

  return (
    <>
      <path d={path} fill="none" stroke={color} strokeWidth={active ? 2.5 : 1.5} />
      {head}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-none absolute rounded border border-ink-600 bg-ink-900/90 px-1.5 py-0.5 font-mono text-[10px] leading-snug"
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
        >
          {data.labels.map((l) => (
            <div key={l.transitionId} className={l.transitionId === data.activeTransitionId ? 'font-bold text-[#302d26]' : 'text-[#514b40]'}>
              {l.text}
            </div>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

const nodeTypes = { state: StateNode };
const edgeTypes = { transition: TransitionEdge };

interface Props {
  graph: Graph;
  currentState?: string | null;
  activeTransitionId?: string | null;
  height?: number;
}

/** State-transition diagram. Highlights the current state and the transition just applied. */
export function StateDiagram({ graph, currentState = null, activeTransitionId = null, height = 340 }: Props) {
  const structureKey = useMemo(() => JSON.stringify([graph.nodes.map((n) => n.id), graph.edges.map((e) => e.id), graph.startId]), [graph]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const positions = useMemo(() => layoutGraph(graph), [structureKey]);

  const nodes = useMemo<Node<StateNodeData>[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'state',
        position: positions[n.id] ?? { x: 0, y: 0 },
        data: { label: n.id, start: n.start, accepting: n.accepting, rejecting: n.rejecting, current: n.id === currentState },
        draggable: true,
      })),
    [graph, positions, currentState],
  );

  const edges = useMemo<Edge<TransitionEdgeData>[]>(() => {
    const ids = new Set(graph.edges.map((e) => e.id));
    return graph.edges.map((e) => {
      const selfLoop = e.source === e.target;
      const reverse = !selfLoop && ids.has(`${e.target}->${e.source}`);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'transition',
        selectable: false,
        data: {
          labels: e.labels,
          activeTransitionId,
          selfLoop,
          curve: reverse ? (e.source < e.target ? 38 : 38) : 0,
        },
      };
    });
  }, [graph, activeTransitionId]);

  if (graph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed border-ink-500 text-sm text-slate-400" style={{ height }}>
        Add states to see the diagram.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-ink-700 bg-ink-900" style={{ height }} aria-label="State transition diagram" role="img">
      <ReactFlow
        key={structureKey}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.2}
        maxZoom={1.6}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#2a3444" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
