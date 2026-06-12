import { useEffect, useRef } from 'react';

import styles from './ServiceNode.module.scss';

export type PathCount = { path: string; count: number };

type Props = {
  id: string;
  x: number;
  y: number;
  active: boolean;
  activityLevel: number;
  errorLevel: number;
  topPaths: PathCount[];
};

const NODE_W = 120;
const NODE_H = 44;
const PATH_LINE_H = 14;
const PATH_MAX_LEN = 22;
const PATH_LIMIT = 7;

function truncate(s: string): string {
  return s.length > PATH_MAX_LEN ? s.slice(0, PATH_MAX_LEN - 1) + '…' : s;
}

export function ServiceNode({ id, x, y, active, activityLevel, errorLevel, topPaths }: Props) {
  const glowRef = useRef<SVGRectElement>(null);
  const errorGlowRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    if (glowRef.current) {
      glowRef.current.style.setProperty('--glow-opacity', String(Math.min(activityLevel, 1)));
    }
  }, [activityLevel]);

  useEffect(() => {
    if (errorGlowRef.current) {
      errorGlowRef.current.style.setProperty('--error-opacity', String(Math.min(errorLevel, 1)));
    }
  }, [errorLevel]);

  const hasError = errorLevel > 0;
  const paths = topPaths.slice(0, PATH_LIMIT);

  return (
    <g
      className={`${styles.node} ${active ? styles.active : ''} ${hasError ? styles.error : ''}`}
      transform={`translate(${x - NODE_W / 2}, ${y - NODE_H / 2})`}
    >
      {paths.length > 0 && (
        <g className={styles.paths}>
          {paths.map((p, i) => {
            const lineY = -(paths.length - i) * PATH_LINE_H - 6;
            const label = truncate(p.path);
            const isLong = p.path.length > PATH_MAX_LEN;
            return (
              <g key={p.path} transform={`translate(0, ${lineY})`}>
                {isLong && <title>{p.path}</title>}
                <text
                  className={styles.pathLabel}
                  x={NODE_W / 2}
                  textAnchor="middle"
                  dominantBaseline="auto"
                >
                  <tspan className={styles.pathText}>{label}</tspan>
                  <tspan className={styles.pathCount}> ×{p.count}</tspan>
                </text>
              </g>
            );
          })}
        </g>
      )}

      <rect ref={glowRef} className={styles.glow} width={NODE_W} height={NODE_H} rx={8} />
      <rect ref={errorGlowRef} className={styles.errorGlow} width={NODE_W} height={NODE_H} rx={8} />
      <rect className={styles.body} width={NODE_W} height={NODE_H} rx={8} />
      <text
        className={styles.label}
        x={NODE_W / 2}
        y={NODE_H / 2}
        dominantBaseline="middle"
        textAnchor="middle"
      >
        {id}
      </text>
    </g>
  );
}

export const NODE_WIDTH = NODE_W;
export const NODE_HEIGHT = NODE_H;
