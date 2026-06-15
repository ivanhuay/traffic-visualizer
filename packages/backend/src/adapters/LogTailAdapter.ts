import { createReadStream, watchFile, unwatchFile, statSync } from 'fs';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';

export type LogLine = {
  service: string;
  line: string;
};

type FileEntry = {
  size: number;
};

export class LogTailAdapter extends EventEmitter {
  // filePath → services registered to receive lines from that file
  private fileServices: Map<string, Set<string>> = new Map();
  private fileEntries: Map<string, FileEntry> = new Map();

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

    watchFile(filePath, { interval: 200 }, (curr) => {
      const entry = this.fileEntries.get(filePath);
      if (!entry) return;

      if (curr.size <= entry.size) {
        entry.size = curr.size;
        return;
      }

      const stream = createReadStream(filePath, {
        start: entry.size,
        end: curr.size - 1,
        encoding: 'utf-8',
      });

      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      rl.on('line', (line) => {
        if (!line.trim()) return;
        for (const svc of this.fileServices.get(filePath) ?? []) {
          this.emit('line', { service: svc, line } satisfies LogLine);
        }
      });

      entry.size = curr.size;
    });

    console.info(`[LogTailAdapter] Watching ${filePath} → service "${service}"`);
  }

  stop(): void {
    for (const filePath of this.fileEntries.keys()) {
      unwatchFile(filePath);
    }
    this.fileServices.clear();
    this.fileEntries.clear();
  }
}
