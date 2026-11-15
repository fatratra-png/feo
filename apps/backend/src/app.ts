import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler } from './lib/http';
import { router } from './routes';
import { outbox } from './services/mail';

/** The Express app, without listening or migrating: shared by the server and the integration tests. */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  // JSON (search results, playlists, home) shrinks ~5×; audio and images are skipped by type.
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  if (config.nodeEnv === 'test') {
    // End-to-end tests read the emails the API would have sent. Never mounted outside tests.
    app.get('/api/test/outbox', (req, res) => res.json(outbox.filter((m) => !req.query.to || m.to === req.query.to)));
  }
  app.use('/api', router);
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Route introuvable' }));
  app.use(errorHandler);
  return app;
}
