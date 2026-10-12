import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ALLOWED_ORIGINS } from './config/env.js';
import { doorbellRouter } from './routes/doorbell.routes.js';
import { callRouter } from './routes/call.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  // 1. Security Headers (configured to allow WebRTC media & WebSockets)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled to allow WebRTC data/media streams and Vite SPA assets
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. Strict CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps or curl) or in allowed list
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS policy blocked access from origin: ${origin}`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 3. Body parser
  app.use(express.json());

  // 4. Healthcheck endpoints
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'urgrowup-doorbell-backend', timestamp: new Date().toISOString() });
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'urgrowup-doorbell-backend', timestamp: new Date().toISOString() });
  });

  // 5. REST API routes
  app.use('/api', doorbellRouter);
  app.use('/api/doorbells', doorbellRouter);
  app.use('/api/calls', callRouter);

  // 6. Serve Frontend Static SPA (client/dist) in production or Docker
  // Look for client/dist relative to project root or dist
  const possibleClientPaths = [
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
  ];

  let clientDistPath: string | null = null;
  for (const p of possibleClientPaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) {
      clientDistPath = p;
      break;
    }
  }

  if (clientDistPath) {
    console.log(`📦 [Static SPA] Serving production client from: ${clientDistPath}`);
    app.use(express.static(clientDistPath));

    // Fallback for SPA client-side routes (/v/:slug, /call/:callId)
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath!, 'index.html'));
    });
  } else {
    app.get('/', (_req: Request, res: Response) => {
      res.send(`
        <h1>UrGrowUp Smart Doorbell Backend API & Signaling Server</h1>
        <p>API endpoints running at <code>/api</code> and Socket.io at <code>/socket.io</code>.</p>
        <p>Run <code>npm run dev:client</code> to launch the Vite frontend during development.</p>
      `);
    });
  }

  // 7. Global API error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor.' : err.message,
    });
  });

  return app;
}
