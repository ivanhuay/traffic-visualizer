import { useEffect, useRef } from 'react';

import styles from './ServiceNode.module.scss';

type Props = {
  id: string;
  x: number;
  y: number;
  active: boolean;
  activityLevel: number;
  errorLevel: number;
};

const NODE_W = 120;
const NODE_H = 44;

export function ServiceNode({ id, x, y, active, activityLevel, errorLevel }: Props) {
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

  return (
    <g
      className={`${styles.node} ${active ? styles.active : ''} ${hasError ? styles.error : ''}`}
      transform={`translate(${x - NODE_W / 2}, ${y - NODE_H / 2})`}
    >
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
