import { useCallback, useEffect, useRef, useState } from 'react';

import { ServiceNode } from '../ServiceNode/ServiceNode.js';
import type { PathCount } from '../ServiceNode/ServiceNode.js';
import { TrafficEdge, edgePath } from '../TrafficEdge/TrafficEdge.js';
import { TrafficParticle } from '../TrafficParticle/TrafficParticle.js';
import { StatsPanel } from '../StatsPanel/StatsPanel.js';
import type { NodeStats } from '../StatsPanel/StatsPanel.js';
import type { FlowEvent, TopologyConfig } from '../../types/index.js';

import styles from './TopologyCanvas.module.scss';

type Props = {
  topology: TopologyConfig;
  events: FlowEvent[];
};

type NodePosition = { x: number; y: number };
type Particle = { id: string; pathD: string; color: string };
type ActivityMap = Record<string, number>;

const DECAY_MS = 3000;
const ERROR_DECAY_MS = 2000;
const PARTICLE_DURATION = 1000;
const ERROR_COLOR = '#f87171';
const PATH_LIMIT = 7;

function computeLayout(nodes: string[], width: number, height: number): Record<string, NodePosition> {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const rowGap = height / (Math.ceil(nodes.length / cols) + 1);
  const positions: Record<string, NodePosition> = {};

  nodes.forEach((node, i) => {
    const col = (i % cols) + 1;
    const row = Math.floor(i / cols) + 1;
    const colsInRow = Math.min(cols, nodes.length - row * cols + cols);
    const colGap = width / (colsInRow + 1);
    positions[node] = { x: col * colGap, y: row * rowGap };
  });

  return positions;
}

function colorFromKey(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (((hash << 5) + hash) ^ key.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 65%)`;
}

function topPaths(counts: Record<string, number>): PathCount[] {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, PATH_LIMIT)
    .map(([path, count]) => ({ path, count }));
}

let particleCounter = 0;

export function TopologyCanvas({ topology, events }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [activity, setActivity] = useState<ActivityMap>({});
  const [errorActivity, setErrorActivity] = useState<ActivityMap>({});
  const [stats, setStats] = useState<Record<string, NodeStats>>({});
  const [pathCounts, setPathCounts] = useState<Record<string, Record<string, number>>>({});
  const processedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const positions = computeLayout(topology.nodes, size.width, size.height);

  useEffect(() => {
    for (const event of events) {
      if (processedRef.current.has(event.timestamp)) continue;
      processedRef.current.add(event.timestamp);

      const isSelfError = event.isError === true && event.from === event.to;
      const color = event.isError
        ? ERROR_COLOR
        : event.correlationId
          ? colorFromKey(event.correlationId)
          : '#38bdf8';

      if (!isSelfError) {
        const fromPos = positions[event.from];
        const toPos = positions[event.to];
        if (fromPos && toPos) {
          const path = edgePath(fromPos, toPos);
          const id = `p-${++particleCounter}`;
          setParticles((prev) => [...prev, { id, pathD: path, color }]);
        }
      }

      if (event.isError) {
        setErrorActivity((prev) => ({ ...prev, [event.from]: 1 }));
        setTimeout(() => {
          setErrorActivity((prev) => ({ ...prev, [event.from]: 0.5 }));
        }, ERROR_DECAY_MS / 2);
        setTimeout(() => {
          setErrorActivity((prev) => ({ ...prev, [event.from]: 0 }));
        }, ERROR_DECAY_MS);
      } else {
        setActivity((prev) => ({ ...prev, [event.from]: 1, [event.to]: 1 }));
        setTimeout(() => {
          setActivity((prev) => ({
            ...prev,
            [event.from]: Math.max((prev[event.from] ?? 0) - 0.5, 0),
            [event.to]: Math.max((prev[event.to] ?? 0) - 0.5, 0),
          }));
        }, DECAY_MS / 2);
        setTimeout(() => {
          setActivity((prev) => ({ ...prev, [event.from]: 0, [event.to]: 0 }));
        }, DECAY_MS);
      }

      if (event.path && !isSelfError) {
        const dest = event.to;
        const p = event.path;
        setPathCounts((prev) => ({
          ...prev,
          [dest]: {
            ...prev[dest],
            [p]: ((prev[dest]?.[p]) ?? 0) + 1,
          },
        }));
      }

      setStats((prev) => {
        const next = { ...prev };
        const ensure = (k: string) => {
          next[k] = { in: next[k]?.in ?? 0, out: next[k]?.out ?? 0, errors: next[k]?.errors ?? 0 };
        };
        ensure(event.from);
        if (!isSelfError) {
          ensure(event.to);
          next[event.to]!.in += 1;
        }
        next[event.from]!.out += 1;
        if (event.isError) next[event.from]!.errors += 1;
        return next;
      });
    }
  }, [events, positions]);

  const removeParticle = useCallback((id: string) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const edgeIntensityMap: Record<string, number> = {};
  for (const [from, to] of topology.edges) {
    const key = `${from}→${to}`;
    edgeIntensityMap[key] = ((activity[from] ?? 0) + (activity[to] ?? 0)) / 2;
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <svg
        className={styles.canvas}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
      >
        <g className={styles.edges}>
          {topology.edges.map(([from, to]) => {
            const fromPos = positions[from];
            const toPos = positions[to];
            if (!fromPos || !toPos) return null;
            return (
              <TrafficEdge
                key={`${from}→${to}`}
                from={fromPos}
                to={toPos}
                intensity={edgeIntensityMap[`${from}→${to}`] ?? 0}
              />
            );
          })}
        </g>

        <g>
          {particles.map((p) => (
            <TrafficParticle
              key={p.id}
              pathD={p.pathD}
              color={p.color}
              duration={PARTICLE_DURATION}
              onComplete={() => removeParticle(p.id)}
            />
          ))}
        </g>

        <g>
          {topology.nodes.map((node) => {
            const pos = positions[node];
            if (!pos) return null;
            return (
              <ServiceNode
                key={node}
                id={node}
                x={pos.x}
                y={pos.y}
                active={(activity[node] ?? 0) > 0}
                activityLevel={activity[node] ?? 0}
                errorLevel={errorActivity[node] ?? 0}
                topPaths={topPaths(pathCounts[node] ?? {})}
              />
            );
          })}
        </g>
      </svg>

      <StatsPanel stats={stats} />
    </div>
  );
}
