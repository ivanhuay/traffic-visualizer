import { useTrafficStream } from './hooks/useTrafficStream.js';
import { TopologyCanvas } from './components/TopologyCanvas/TopologyCanvas.js';

import styles from './App.module.scss';

export function App() {
  const { connected, topology, events } = useTrafficStream('/ws');

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.title}>traffic visualizer</span>
        <span className={`${styles.status} ${connected ? styles.connected : styles.disconnected}`}>
          {connected ? '● live' : '○ connecting...'}
        </span>
      </header>

      <main className={styles.main}>
        {topology ? (
          <TopologyCanvas topology={topology} events={events} />
        ) : (
          <div className={styles.loading}>waiting for topology...</div>
        )}
      </main>
    </div>
  );
}
