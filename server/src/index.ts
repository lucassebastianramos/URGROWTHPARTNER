import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { ENV, ALLOWED_ORIGINS } from './config/env.js';
import { setupSignalingHandlers } from './socket/signaling.handler.js';
import { prisma } from './db/prisma.js';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './socket/signaling.types.js';

async function bootstrap() {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Initialize Socket.io Server with strict CORS
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin: (origin, callback) => {
          if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`CORS blocked Socket.io connection from: ${origin}`));
          }
        },
        credentials: true,
        methods: ['GET', 'POST'],
      },
      pingTimeout: 25000,
      pingInterval: 10000,
    }
  );

  // Setup WebRTC signaling handlers
  setupSignalingHandlers(io);

  // Start HTTP server on 0.0.0.0 for Docker & LAN binding
  httpServer.listen(ENV.PORT, '0.0.0.0', () => {
    console.log('====================================================');
    console.log(`🚀 UrGrowUp Smart Doorbell Backend Server Running`);
    console.log(`🌐 Base URL:   ${ENV.APP_URL}`);
    console.log(`📡 Local Port: ${ENV.PORT}`);
    console.log(`🔒 STUN Server: ${ENV.STUN_SERVER_URL}`);
    console.log(`⏱️ Call Timeout: ${ENV.CALL_TIMEOUT_SECONDS}s`);
    console.log('====================================================');
  });

  // Graceful shutdown
  const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    try {
      io.close();
      httpServer.close(async () => {
        console.log('🚪 HTTP and WebSocket servers closed.');
        await prisma.$disconnect();
        console.log('🗄️ Database disconnected. Process exit complete.');
        process.exit(0);
      });
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('💥 Fatal bootstrap error:', error);
  process.exit(1);
});
