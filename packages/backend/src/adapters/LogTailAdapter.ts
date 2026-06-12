import { createReadStream, watchFile, unwatchFile, statSync } from 'fs';
import { createInterface } from 'readline';
import { EventEmitter } from 'events';

export type LogLine = {
  service: string;
  line: string;
};

type WatchedFile = {
  service: string;
  path: string;
  size: number;
};

export class LogTailAdapter extends EventEmitter {
  private watched: WatchedFile[] = [];

  watch(service: string, filePath: string): void {
    let size = 0;
    try {
      size = statSync(filePath).size;
    } catch {
      size = 0;
    }

    this.watched.push({ service, path: filePath, size });

    watchFile(filePath, { interval: 200 }, (curr) => {
      const entry = this.watched.find((w) => w.path === filePath);
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
        if (line.trim()) {
          this.emit('line', { service: entry.service, line } satisfies LogLine);
        }
      });

      entry.size = curr.size;
    });

    console.info(`[LogTailAdapter] Watching ${filePath} as service "${service}"`);
  }

  stop(): void {
    for (const entry of this.watched) {
      unwatchFile(entry.path);
    }
    this.watched = [];
  }
}
