import http from 'node:http';
import { Server as SocketServer } from 'socket.io';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { closeRedis, connectRedis } from './config/redis.js';
import { registerTrackingSocket } from './modules/tracking/tracking.socket.js';

const app = createApp();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: env.corsOrigin,
    credentials: true
  }
});

registerTrackingSocket(io);

try {
  await connectRedis();

  server.listen(env.port, () => {
    console.log(`Cafe Direct API listening on http://localhost:${env.port}`);
  });
} catch (error) {
  console.error('Failed to start Cafe Direct API:', error.message);
  process.exit(1);
}

async function shutdown(signal) {
  console.log(`${signal} received. Closing server...`);
  server.close(async () => {
    await closeRedis();
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
