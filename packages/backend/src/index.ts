import 'dotenv/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';

import { LogTailAdapter } from './adapters/LogTailAdapter.js';
import { loadPatterns, loadTopology } from './config/loader.js';
import { EventService } from './services/EventService.js';
import { WSServer } from './websocket/WSServer.js';

const PORT = Number(process.env['PORT'] ?? 3001);
const LOG_DIR = process.env['LOG_DIR'] ?? resolve(fileURLToPath(import.meta.url), '../../logs');

async function main() {
  const topology = loadTopology();
  const patterns = loadPatterns();

  const fastify = Fastify({ logger: false });
  await fastify.register(websocketPlugin);

  const wsServer = new WSServer(topology);
  wsServer.register(fastify);

  fastify.get('/health', async () => ({ status: 'ok' }));
  fastify.get('/topology', async () => topology);

  const eventService = new EventService(patterns, topology.correlationKeyField);
  const tailAdapter = new LogTailAdapter();

  eventService.on('event', (event) => {
    const path = event.path ? ` ${event.path}` : '';
    const error = event.isError ? ' [ERROR]' : '';
    console.info(`[${event.from}] -> [${event.to}]${path}${error}`);
    wsServer.broadcast(event);
  });

  tailAdapter.on('line', (logLine) => {
    eventService.processLine(logLine);
  });

  for (const node of topology.nodes) {
    const svc = patterns.find((p) => p.service === node);

    // Service-level file override
    const defaultLog = svc?.logFile
      ? svc.logFile
      : svc?.logFileName
        ? resolve(LOG_DIR, svc.logFileName)
        : resolve(LOG_DIR, `${node}.log`);
    tailAdapter.watch(node, defaultLog);

    // Pattern-level logFileName: additional files this service should listen on
    for (const pat of svc?.patterns ?? []) {
      if (pat.logFileName) {
        tailAdapter.watch(node, resolve(LOG_DIR, pat.logFileName));
      }
    }
  }

  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.info(`[Backend] Listening on http://0.0.0.0:${PORT}`);
  console.info(`[Backend] WebSocket on ws://0.0.0.0:${PORT}/ws`);

  process.on('SIGINT', () => {
    tailAdapter.stop();
    fastify.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Backend] Fatal:', err);
  process.exit(1);
});
