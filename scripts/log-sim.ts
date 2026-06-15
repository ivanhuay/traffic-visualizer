/**
 * Log file simulator — replays lines from scripts/simulated/<name>.log
 * into packages/backend/logs/<name>.log at a configurable rate.
 *
 * Each tick appends N lines from each simulated file, cycling back to
 * the start when exhausted. Lines are written one at a time with a
 * small delay so fs.watchFile fires per-line.
 *
 * Usage:
 *   pnpm log-sim                    — 2 lines / 1000ms per file
 *   pnpm log-sim -t 500 -l 3        — 3 lines every 500ms per file
 *   pnpm log-sim -f bff.log         — only replay bff.log
 *   pnpm log-sim --loop             — loop forever (default: loops)
 *   pnpm log-sim --once             — replay each file once then exit
 */

import { readFileSync, readdirSync, appendFileSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const SIMULATED_DIR = resolve(ROOT, 'scripts/simulated');
const LOG_DIR = resolve(ROOT, 'packages/backend/logs');

mkdirSync(LOG_DIR, { recursive: true });

const args = process.argv.slice(2);

function flag(name: string, defaultVal: number): number {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] !== undefined ? Number(args[idx + 1]) : defaultVal;
}

function flagStr(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const INTERVAL_MS = flag('-t', 1000);
const LINES_PER_TICK = flag('-l', 2);
const ONLY_FILE = flagStr('-f');
const ONCE = args.includes('--once');
const LINE_DELAY_MS = 15;

type SimFile = {
  filename: string;
  destPath: string;
  lines: string[];
  cursor: number;
  exhausted: boolean;
};

function loadSimFiles(): SimFile[] {
  const all = readdirSync(SIMULATED_DIR).filter((f) => f.endsWith('.log'));
  const filtered = ONLY_FILE ? all.filter((f) => f === ONLY_FILE || f === basename(ONLY_FILE)) : all;

  if (filtered.length === 0) {
    console.error(`[log-sim] No matching .log files in ${SIMULATED_DIR}`);
    process.exit(1);
  }

  return filtered.map((filename) => {
    const raw = readFileSync(resolve(SIMULATED_DIR, filename), 'utf-8');
    const lines = raw.split('\n').filter((l) => l.trim());
    return {
      filename,
      destPath: resolve(LOG_DIR, filename),
      lines,
      cursor: 0,
      exhausted: false,
    };
  });
}

function timestamp(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function emitLines(sim: SimFile, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    if (sim.cursor >= sim.lines.length) {
      if (ONCE) {
        sim.exhausted = true;
        return;
      }
      sim.cursor = 0;
    }

    const raw = sim.lines[sim.cursor++]!;
    const line = `${timestamp()} ${raw}\n`;
    appendFileSync(sim.destPath, line, 'utf-8');

    if (i < count - 1) {
      await delay(LINE_DELAY_MS);
    }
  }
}

async function tick(simFiles: SimFile[]): Promise<void> {
  for (const sim of simFiles) {
    if (sim.exhausted) continue;
    await emitLines(sim, LINES_PER_TICK);
  }
}

async function run(): Promise<void> {
  const simFiles = loadSimFiles();

  console.info(`[log-sim] ${simFiles.length} file(s) — ${LINES_PER_TICK} line(s) / ${INTERVAL_MS}ms`);
  for (const f of simFiles) {
    console.info(`  ${f.filename} → ${f.destPath} (${f.lines.length} source lines)`);
  }
  console.info(ONCE ? '[log-sim] --once: exits after each file exhausted' : '[log-sim] Looping (Ctrl+C to stop)');

  if (ONCE) {
    const totalLines = Math.max(...simFiles.map((f) => f.lines.length));
    const ticks = Math.ceil(totalLines / LINES_PER_TICK);
    for (let t = 0; t < ticks; t++) {
      await tick(simFiles);
      if (simFiles.every((f) => f.exhausted)) break;
      if (t < ticks - 1) await delay(INTERVAL_MS);
    }
    console.info('[log-sim] Done');
    return;
  }

  const run = (): void => {
    tick(simFiles).catch(console.error);
  };

  run();
  setInterval(run, INTERVAL_MS);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
