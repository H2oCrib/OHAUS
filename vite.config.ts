import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { WebSocketServer } from 'ws'
import type { PluginOption } from 'vite'

function scannerRelayPlugin(): PluginOption {
  return {
    name: 'scanner-relay',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const clients = new Set<import('ws').WebSocket>();

      wss.on('connection', (ws) => {
        clients.add(ws);
        ws.on('message', (data) => {
          // Broadcast to all OTHER connected clients
          const msg = data.toString();
          for (const client of clients) {
            if (client !== ws && client.readyState === 1) {
              client.send(msg);
            }
          }
        });
        ws.on('close', () => clients.delete(ws));
      });

      server.httpServer?.on('upgrade', (req, socket, head) => {
        if (req.url === '/ws/scanner') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), scannerRelayPlugin()],
  server: {
    host: true,
  },
})
