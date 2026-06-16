import { createReadStream, statSync } from 'fs';
import { EventEmitter } from 'events';
import chokidar, { FSWatcher } from 'chokidar';

export type LogLine = {
  service: string;
  line: string;
};

type FileEntry = {
  size: number;
};

export class LogTailAdapter extends EventEmitter {
  private fileServices: Map<string, Set<string>> = new Map();
  private fileEntries: Map<string, FileEntry> = new Map();
  private lineBuffers: Map<string, string> = new Map();
  private watcher: FSWatcher | null = null;
  private safetyTimer: NodeJS.Timeout | null = null;

  watch(service: string, filePath: string): void {
    const existing = this.fileServices.get(filePath);

    if (existing) {
      if (!existing.has(service)) {
        existing.add(service);
        console.info(`[LogTailAdapter] Added service "${service}" to existing watcher for ${filePath}`);
      }
      return;
    }

    let size = 0;
    try {
      size = statSync(filePath).size;
    } catch {
      size = 0;
    }

    this.fileServices.set(filePath, new Set([service]));
    this.fileEntries.set(filePath, { size });
    this.lineBuffers.set(filePath, '');

    if (!this.watcher) {
      this.watcher = chokidar.watch([], {
        persistent: true,
        ignoreInitial: true,
        usePolling: false,
        awaitWriteFinish: false,
      });

      this.watcher.on('add', (fp) => this.handleChange(fp));
      this.watcher.on('change', (fp) => this.handleChange(fp));
      this.watcher.on('error', (err) => console.error('[LogTailAdapter] watcher error:', err));

      // fs.watch can coalesce/drop the last notification in a burst (documented
      // Node caveat). Re-check every 750ms so a missed event self-heals quickly
      // instead of waiting indefinitely for the next unrelated write.
      this.safetyTimer = setInterval(() => {
        for (const filePath of this.fileEntries.keys()) {
          this.handleChange(filePath);
        }
      }, 750);
    }

    this.watcher.add(filePath);
    console.info(`[LogTailAdapter] Watching ${filePath} → service "${service}"`);
  }

  private handleChange(filePath: string): void {
    const entry = this.fileEntries.get(filePath);
    if (!entry) return;

    let currSize: number;
    try {
      currSize = statSync(filePath).size;
    } catch {
      return;
    }

    if (currSize < entry.size) {
      // truncation / rotation — reset
      entry.size = 0;
      this.lineBuffers.set(filePath, '');
    }

    if (currSize <= entry.size) return;

    const start = entry.size;
    const end = currSize - 1;
    entry.size = currSize;

    const stream = createReadStream(filePath, { start, end, encoding: 'utf-8' });
    let chunk = this.lineBuffers.get(filePath) ?? '';

    stream.on('data', (d: string | Buffer) => { chunk += d.toString(); });
    stream.on('end', () => {
      const lines = chunk.split('\n');
      this.lineBuffers.set(filePath, lines.pop() ?? '');
      for (const line of lines) {
        if (!line.trim()) continue;
        for (const svc of this.fileServices.get(filePath) ?? []) {
          this.emit('line', { service: svc, line } satisfies LogLine);
        }
      }
    });
    stream.on('error', (err) => {
      console.error(`[LogTailAdapter] stream error for ${filePath}:`, err);
    });
  }

  stop(): void {
    this.watcher?.close().catch(() => {});
    this.watcher = null;
    if (this.safetyTimer) {
      clearInterval(this.safetyTimer);
      this.safetyTimer = null;
    }
    this.fileServices.clear();
    this.fileEntries.clear();
    this.lineBuffers.clear();
  }
}
