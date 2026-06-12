# Traffic Visualizer

Real-time traffic flow visualizer for distributed systems. Monitors log files, detects inter-service calls via configurable patterns, and renders animated particle flows between nodes in a browser.

```
Client ──→ BFF ──→ Core MS ──→ Products MS
                └──→ Tenants API
```

Each request becomes a particle that travels through the graph. Requests sharing a correlation ID get the same color. Errors glow red.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 20+, TypeScript, Fastify, WebSocket |
| Frontend | React 18, TypeScript, Vite, SVG animations |
| Monorepo | pnpm workspaces |

---

## Quick start

```bash
# Install dependencies
pnpm install

# Copy env file
cp packages/backend/.env.example packages/backend/.env

# Run backend + frontend in parallel
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How it works

1. The backend watches log files (`packages/backend/logs/<service>.log`) via `fs.watchFile`.
2. Each new line is matched against the patterns defined in `config/patterns.json`.
3. A match emits a `FlowEvent` (`from`, `to`, `correlationId`, `isError`) over WebSocket.
4. The frontend receives events and animates particles along SVG edges between nodes.

---

## Configuration

### Topology — `packages/backend/config/topology.json`

Declares the system graph and the correlation key field to extract from logs.

```json
{
  "correlationKeyField": "idempotency-key",
  "nodes": ["client", "bff", "core-ms", "products-ms"],
  "edges": [
    ["client", "bff"],
    ["bff", "core-ms"],
    ["core-ms", "products-ms"]
  ]
}
```

| Field | Description |
|---|---|
| `nodes` | Service names — one log file per node (`logs/<name>.log`) |
| `edges` | Directed connections shown in the graph |
| `correlationKeyField` | JSON field name extracted from log lines to group requests by color. Optional — defaults to `idempotency-key` |

**`correlationKeyField` extraction**

The detector looks for this pattern in each log line:

```
"<correlationKeyField>":"<value>"
```

Examples by field name:

| `correlationKeyField` | Matches in log |
|---|---|
| `idempotency-key` | `"idempotency-key":"ik_abc123"` |
| `x-trace-id` | `"x-trace-id":"t_xyz789"` |
| `correlation-id` | `"correlation-id":"req-001"` |

All events sharing the same extracted value are rendered with the same particle color, making it easy to follow a single request across services.

---

### Patterns — `packages/backend/config/patterns.json`

Defines what to detect per service.

```json
[
  {
    "service": "bff",
    "patterns": [
      { "to": "core-ms",    "match": "calling core-ms" },
      { "to": "tenants-api", "match": "calling tenants-api" }
    ],
    "errorPatterns": ["[Error]", "[ERROR]", "ECONNREFUSED", "failed"]
  }
]
```

| Field | Description |
|---|---|
| `service` | Must match a node name in `topology.json` |
| `patterns[].match` | Substring to look for in a log line |
| `patterns[].to` | Target node when the pattern matches |
| `errorPatterns` | Substrings that mark a line as an error — triggers red particle and red node glow |

**Match priority:** if a line matches both a flow pattern and an error pattern, a single red-particle event is emitted with the correct `from`/`to`. If only an error pattern matches (no flow target known), a self-event is emitted — the source node pulses red.

---

### Environment — `packages/backend/.env`

```env
PORT=3001
LOG_DIR=./logs
```

`LOG_DIR` is relative to `packages/backend/`. Override to point at a directory of existing log files.

---

## Connecting your own logs

Point `LOG_DIR` at a directory that contains files named `<service>.log`, matching the node names in `topology.json`.

```bash
# Example: tail your own app logs
LOG_DIR=/var/log/myapp pnpm --filter @traffic-visualizer/backend dev
```

The backend appends only — it tails from the current file offset, so pre-existing content is ignored on startup.

---

## Demo traffic generator

Generates fake log lines that match the default patterns, for visual testing without a real system.

```bash
pnpm traffic-gen              # 3 req/s steady
pnpm traffic-gen --rate=10    # 10 req/s
pnpm traffic-gen --errors     # 3 req/s + ~15% error rate
pnpm traffic-gen:chaos        # 8 req/s + ~15% error rate
pnpm traffic-gen:burst        # 20 concurrent requests, then exit
```

Shorthand scripts defined in `package.json`:

| Script | Equivalent |
|---|---|
| `pnpm traffic-gen` | `tsx scripts/traffic-gen.ts` |
| `pnpm traffic-gen:burst` | `tsx scripts/traffic-gen.ts --burst` |
| `pnpm traffic-gen:fast` | `tsx scripts/traffic-gen.ts --rate=10` |
| `pnpm traffic-gen:errors` | `tsx scripts/traffic-gen.ts --errors` |
| `pnpm traffic-gen:chaos` | `tsx scripts/traffic-gen.ts --rate=8 --errors` |

---

## Event model

All adapters (current and future) produce this format:

```ts
type FlowEvent = {
  from: string;           // source service
  to: string;             // target service (equals `from` for node-only errors)
  timestamp: number;      // Unix ms
  requestId?: string;     // extracted from req-id=... / request-id=...
  correlationId?: string; // extracted from "<correlationKeyField>":"..."
  isError?: boolean;      // true when an error pattern matched
};
```

The WebSocket server sends two message types:

```ts
// Sent once on connection
{ type: 'topology', payload: TopologyConfig }

// Sent on each detected event
{ type: 'flow_event', payload: FlowEvent }
```

---

## Project structure

```
traffic-visualizer/
├── packages/
│   ├── backend/
│   │   ├── config/
│   │   │   ├── topology.json       ← graph + correlationKeyField
│   │   │   └── patterns.json       ← per-service match rules + errorPatterns
│   │   ├── logs/                   ← watched log files (gitignored)
│   │   └── src/
│   │       ├── adapters/           ← log tail (future: Datadog, OTel, Kafka)
│   │       ├── detectors/          ← pattern matching → FlowEvent
│   │       ├── services/           ← orchestration
│   │       ├── websocket/          ← WS server, broadcast
│   │       ├── config/             ← JSON loaders
│   │       └── types/              ← FlowEvent, TopologyConfig, PatternConfig
│   └── frontend/
│       └── src/
│           ├── hooks/
│           │   ├── useTrafficStream.ts   ← WebSocket client, auto-reconnect
│           │   └── useTopology.ts        ← fetches topology on mount
│           └── components/
│               ├── TopologyCanvas/       ← SVG layout, particle orchestration
│               ├── ServiceNode/          ← node with activity + error glow
│               ├── TrafficEdge/          ← bezier edge with intensity
│               ├── TrafficParticle/      ← rAF-animated particle
│               └── StatsPanel/           ← in/out/error counters per node
├── scripts/
│   └── traffic-gen.ts              ← fake log generator
├── tsconfig.base.json
├── eslint.config.mjs
└── pnpm-workspace.yaml
```

---

## Adding a new adapter

Create a class in `packages/backend/src/adapters/` that emits `FlowEvent` objects. Wire it up in `src/index.ts` alongside (or instead of) `LogTailAdapter`.

```ts
// Example skeleton
import { EventEmitter } from 'events';
import type { FlowEvent } from '../types/index.js';

export class DatadogAdapter extends EventEmitter {
  start(): void {
    // poll or subscribe, then:
    this.emit('event', { from: 'bff', to: 'core-ms', timestamp: Date.now() } satisfies FlowEvent);
  }
}
```

---

## Scripts reference

| Command | Description |
|---|---|
| `pnpm dev` | Start backend + frontend in parallel |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm lint` | ESLint across all packages |
| `pnpm format` | Prettier across all files |
| `pnpm traffic-gen` | Start fake traffic generator |
