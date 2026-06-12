import { useEffect, useState } from 'react';

import type { TopologyConfig } from '../types/index.js';

type State =
  | { status: 'loading' }
  | { status: 'ready'; topology: TopologyConfig }
  | { status: 'error'; message: string };

export function useTopology(): State {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    fetch('/topology')
      .then((r) => r.json())
      .then((data) => setState({ status: 'ready', topology: data as TopologyConfig }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setState({ status: 'error', message });
      });
  }, []);

  return state;
}
