import styles from './TrafficEdge.module.scss';

type Point = { x: number; y: number };

type Props = {
  from: Point;
  to: Point;
  intensity: number;
};

export function TrafficEdge({ from, to, intensity }: Props) {
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2 - 30;

  const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  const clampedIntensity = Math.min(intensity, 1);

  return (
    <g className={styles.edge}>
      <path
        className={styles.glow}
        d={d}
        style={{ opacity: clampedIntensity * 0.6 }}
      />
      <path
        className={styles.line}
        d={d}
        style={{ opacity: 0.3 + clampedIntensity * 0.5 }}
      />
    </g>
  );
}

export function edgePath(from: Point, to: Point): string {
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2 - 30;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}
