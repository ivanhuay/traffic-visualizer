import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';

import type { FlowEvent } from '../types/index.js';
import type { TopologyConfig } from '../types/index.js';

export class WSServer {
  private clients: Set<WebSocket> = new Set();
  private topology: TopologyConfig;

  constructor(topology: TopologyConfig) {
    this.topology = topology;
  }

  register(fastify: FastifyInstance): void {
    fastify.get('/ws', { websocket: true }, (socket) => {
      this.clients.add(socket);
      console.info(`[WSServer] Client connected. Total: ${this.clients.size}`);

      socket.send(
        JSON.stringify({
          type: 'topology',
          payload: this.topology,
        }),
      );

      socket.on('close', () => {
        this.clients.delete(socket);
        console.info(`[WSServer] Client disconnected. Total: ${this.clients.size}`);
      });

      socket.on('error', (err: Error) => {
        console.error('[WSServer] Socket error:', err.message);
        this.clients.delete(socket);
      });
    });
  }

  broadcast(event: FlowEvent): void {
    const message = JSON.stringify({ type: 'flow_event', payload: event });
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }
}
