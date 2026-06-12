import type { FlowEvent } from '../types/index.js';
import type { PatternConfig } from '../types/index.js';

const REQUEST_ID_RE = /req(?:uest)?[-_]?id[=:\s]+([a-zA-Z0-9-]+)/i;

export class PatternDetector {
  private config: PatternConfig;
  private correlationRe: RegExp;

  constructor(config: PatternConfig, correlationKeyField = 'idempotency-key') {
    this.config = config;
    const escaped = correlationKeyField.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    this.correlationRe = new RegExp(`"${escaped}"\\s*:\\s*"([^"]+)"`);
  }

  detect(service: string, line: string): FlowEvent[] {
    const serviceConfig = this.config.find((s) => s.service === service);
    if (!serviceConfig) return [];

    const correlationId = line.match(this.correlationRe)?.[1];
    const requestId = line.match(REQUEST_ID_RE)?.[1];
    const extras = {
      ...(requestId !== undefined ? { requestId } : {}),
      ...(correlationId !== undefined ? { correlationId } : {}),
    };

    const isError = serviceConfig.errorPatterns?.some((p) => line.includes(p)) ?? false;

    for (const pattern of serviceConfig.patterns) {
      if (line.includes(pattern.match)) {
        return [
          {
            from: service,
            to: pattern.to,
            timestamp: Date.now(),
            ...extras,
            ...(isError ? { isError: true } : {}),
          },
        ];
      }
    }

    if (isError) {
      return [{ from: service, to: service, timestamp: Date.now(), ...extras, isError: true }];
    }

    return [];
  }
}
