/**
 * Fake traffic log generator for demo purposes.
 * Writes log lines to packages/backend/logs/<service>.log
 *
 * Usage:
 *   pnpm traffic-gen                  — 3 req/s steady
 *   pnpm traffic-gen --rate=10        — 10 req/s
 *   pnpm traffic-gen --burst          — 20 concurrent requests
 *   pnpm traffic-gen --errors         — inject random errors (~15% rate)
 */

import { appendFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const LOG_DIR = resolve(ROOT, 'packages/backend/logs');

mkdirSync(LOG_DIR, { recursive: true });

const args = process.argv.slice(2);
const rateArg = args.find((a) => a.startsWith('--rate='));
const RATE = rateArg ? Number(rateArg.split('=')[1]) : 3;
const BURST = args.includes('--burst');
const WITH_ERRORS = args.includes('--errors');

type Step = { service: string; line: string };
type Route = { steps: Step[]; useCorrelation?: boolean };

const ROUTES: Route[] = [
  {
    useCorrelation: true,
    steps: [
      { service: 'client',  line: 'calling bff POST /api/resource __CID__ req-id=__REQ__' },
      { service: 'bff',     line: 'calling core-ms GET /api/data __CID__ request-id=__REQ__' },
      { service: 'core-ms', line: 'calling products-ms productsService:getProducts __CID__ req-id=__REQ__' },
    ],
  },
  {
    steps: [
      { service: 'client',     line: 'calling bff GET /api/tenants req-id=__REQ__' },
      { service: 'bff',        line: 'calling tenants-api GET /api/tenants req-id=__REQ__' },
    ],
  },
  {
    useCorrelation: true,
    steps: [
      { service: 'client',  line: 'POST /api/submit calling bff __CID__ req-id=__REQ__' },
      { service: 'bff',     line: 'calling core-ms POST /api/process __CID__ req-id=__REQ__' },
      { service: 'core-ms', line: 'calling products-ms productsService:getProduct __CID__ req-id=__REQ__' },
    ],
  },
  {
    steps: [
      { service: 'client', line: 'calling bff GET /api/items req-id=__REQ__' },
      { service: 'bff',    line: 'calling core-ms GET /api/items req-id=__REQ__' },
    ],
  },
  {
    useCorrelation: true,
    steps: [
      { service: 'client',  line: 'calling bff POST /api/sync __CID__ req-id=__REQ__' },
      { service: 'bff',     line: 'calling core-ms POST /api/resource __CID__ req-id=__REQ__' },
      { service: 'core-ms', line: 'calling products-ms catalogService:listProducts __CID__ req-id=__REQ__' },
    ],
  },
];

const ERROR_SCENARIOS: Step[][] = [
  [{ service: 'bff',      line: '[Error] upstream error calling core-ms: ECONNREFUSED req-id=__REQ__' }],
  [{ service: 'core-ms',  line: '[ERROR] calling products-ms failed: timeout req-id=__REQ__' }],
  [{ service: 'bff',      line: '[Error] calling tenants-api failed: 503 req-id=__REQ__' }],
  [{ service: 'client',   line: '[ERROR] calling bff timeout req-id=__REQ__' }],
  [
    { service: 'bff',     line: 'calling core-ms POST /api/process req-id=__REQ__' },
    { service: 'core-ms', line: '[Error] calling products-ms not found req-id=__REQ__' },
  ],
];

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function randomCorrelationId(): string {
  return `cid_${Math.random().toString(36).slice(2, 14)}`;
}

function cidFragment(cid: string): string {
  return `"idempotency-key":"${cid}"`;
}

function writeLog(service: string, message: string): void {
  const ts = new Date().toISOString();
  appendFileSync(resolve(LOG_DIR, `${service}.log`), `${ts} [${service}] ${message}\n`, 'utf-8');
}

async function emitSteps(steps: Step[], reqId: string, cid?: string): Promise<void> {
  for (const step of steps) {
    let line = step.line.replace(/__REQ__/g, reqId);
    if (cid) {
      line = line.replace(/__CID__/g, cidFragment(cid));
    } else {
      line = line.replace(/__CID__\s*/g, '');
    }
    writeLog(step.service, line);
    await delay(40 + Math.random() * 80);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function emitRoute(route: Route, injectError: boolean): Promise<void> {
  const reqId = randomId();
  const cid = route.useCorrelation ? randomCorrelationId() : undefined;

  await emitSteps(route.steps, reqId, cid);

  if (injectError && WITH_ERRORS) {
    const scenario = ERROR_SCENARIOS[Math.floor(Math.random() * ERROR_SCENARIOS.length)]!;
    await delay(20 + Math.random() * 60);
    await emitSteps(scenario, reqId, cid);
  }
}

async function burstMode(): Promise<void> {
  console.info('[traffic-gen] BURST mode — 20 concurrent requests');
  const promises: Promise<void>[] = [];
  for (let i = 0; i < 20; i++) {
    const route = ROUTES[Math.floor(Math.random() * ROUTES.length)]!;
    const injectError = WITH_ERRORS && Math.random() < 0.2;
    promises.push(emitRoute(route, injectError));
    await delay(25);
  }
  await Promise.all(promises);
  console.info('[traffic-gen] Burst complete');
}

async function steadyMode(): Promise<void> {
  const intervalMs = 1000 / RATE;
  const errorMsg = WITH_ERRORS ? ' + errors ~15%' : '';
  console.info(`[traffic-gen] Steady mode — ${RATE} req/s${errorMsg} (Ctrl+C to stop)`);

  while (true) {
    const route = ROUTES[Math.floor(Math.random() * ROUTES.length)]!;
    const injectError = WITH_ERRORS && Math.random() < 0.15;
    emitRoute(route, injectError).catch(console.error);
    await delay(intervalMs + (Math.random() - 0.5) * intervalMs * 0.4);
  }
}

async function run() {
  if (BURST) {
    await burstMode();
  } else {
    await steadyMode();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
