import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { apiLimiter } from './middleware/rateLimit.js';
import authRouter from './modules/auth/auth.routes.js';
import milkRouter from './modules/milk/milk.routes.js';
import paymentsRouter from './modules/payments/payments.routes.js';
import settlementRouter from './modules/settlement/settlement.routes.js';
import familyRouter from './modules/family/family.routes.js';
import auditRouter from './modules/audit/audit.routes.js';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. CORS
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    })
  );

  // 3. Cookie & Body Parsers
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 4. Rate Limiter on all API routes
  app.use('/api', apiLimiter);

  // 5. Health Check Endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'family-milk-account',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  });

  // 6. API Route Modules
  app.use('/api/auth', authRouter);
  app.use('/api/milk', milkRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/settlement', settlementRouter);
  app.use('/api/family', familyRouter);
  app.use('/api/audit', auditRouter);

  // 7. Client static assets and SPA fallback
  const distCandidates = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../../../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
  ];

  const activeDistPath = distCandidates.find((candidate) => fs.existsSync(candidate)) || null;

  if (activeDistPath) {
    app.use(express.static(activeDistPath));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(activeDistPath, 'index.html'));
    });
  }

  // 8. Centralized Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  return app;
}
