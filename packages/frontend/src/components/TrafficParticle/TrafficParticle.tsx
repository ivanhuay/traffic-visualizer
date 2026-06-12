import { useEffect, useRef } from 'react';

import styles from './TrafficParticle.module.scss';

type Props = {
  pathD: string;
  color: string;
  duration?: number;
  onComplete: () => void;
};

export function TrafficParticle({ pathD, color, duration = 1000, onComplete }: Props) {
  const groupRef = useRef<SVGGElement>(null);
  const animRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const phantom = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    phantom.setAttribute('d', pathD);
    pathRef.current = phantom;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed / duration, 1);

      if (pathRef.current && groupRef.current) {
        const totalLength = pathRef.current.getTotalLength();
        const point = pathRef.current.getPointAtLength(t * totalLength);
        groupRef.current.setAttribute('transform', `translate(${point.x}, ${point.y})`);
        groupRef.current.style.opacity = String(t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15);
      }

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        onComplete();
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [pathD, duration, onComplete]);

  return (
    <g ref={groupRef} className={styles.particle} pointerEvents="none">
      <circle r={6} fill={color} style={{ filter: `blur(3px)`, opacity: 0.6 }} />
      <circle r={3} fill={color} />
    </g>
  );
}
