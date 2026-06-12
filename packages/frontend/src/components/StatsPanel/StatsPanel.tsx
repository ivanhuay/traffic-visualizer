import styles from './StatsPanel.module.scss';

export type NodeStats = {
  in: number;
  out: number;
  errors: number;
};

type Props = {
  stats: Record<string, NodeStats>;
};

export function StatsPanel({ stats }: Props) {
  const nodes = Object.keys(stats).sort();
  if (nodes.length === 0) return null;

  const totalIn = nodes.reduce((s, n) => s + (stats[n]?.in ?? 0), 0);
  const totalErrors = nodes.reduce((s, n) => s + (stats[n]?.errors ?? 0), 0);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>node traffic</span>
        <span className={styles.totals}>
          <span className={styles.totalIn}>{totalIn} req</span>
          {totalErrors > 0 && <span className={styles.totalErr}>{totalErrors} err</span>}
        </span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>service</th>
            <th title="requests in">in</th>
            <th title="requests out">out</th>
            <th title="errors">err</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const s = stats[node] ?? { in: 0, out: 0, errors: 0 };
            return (
              <tr key={node} className={s.errors > 0 ? styles.hasError : ''}>
                <td className={styles.nodeName}>{node}</td>
                <td className={styles.countIn}>{s.in}</td>
                <td className={styles.countOut}>{s.out}</td>
                <td className={s.errors > 0 ? styles.countErr : styles.countZero}>{s.errors}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
