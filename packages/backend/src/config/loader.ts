import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

import type { TopologyConfig } from '../types/index.js';
import type { PatternConfig } from '../types/index.js';

const root = resolve(fileURLToPath(import.meta.url), '../../../');

export function loadTopology(): TopologyConfig {
  const raw = readFileSync(resolve(root, 'config/topology.json'), 'utf-8');
  return JSON.parse(raw) as TopologyConfig;
}

export function loadPatterns(): PatternConfig {
  const raw = readFileSync(resolve(root, 'config/patterns.json'), 'utf-8');
  return JSON.parse(raw) as PatternConfig;
}
