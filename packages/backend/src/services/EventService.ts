import { EventEmitter } from 'events';

import type { LogLine } from '../adapters/LogTailAdapter.js';
import { PatternDetector } from '../detectors/PatternDetector.js';
import type { FlowEvent, PatternConfig } from '../types/index.js';

export class EventService extends EventEmitter {
  private detector: PatternDetector;

  constructor(patterns: PatternConfig, correlationKeyField?: string) {
    super();
    this.detector = new PatternDetector(patterns, correlationKeyField);
  }

  processLine(logLine: LogLine): void {
    const events = this.detector.detect(logLine.service, logLine.line);
    for (const event of events) {
      this.emit('event', event satisfies FlowEvent);
    }
  }
}
