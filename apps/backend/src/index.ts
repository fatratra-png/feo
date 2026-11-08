import cors from 'cors';
import express from 'express';
import { aiEnabled, config } from './config';
import { errorHandler } from './lib/http';
import { migrate } from './migrate';
import { router } from './routes';

async function main() {
  await migrate();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', router);
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Route introuvable' }));
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`FEO API → http://localhost:${config.port}/api`);
    console.log(`AI: ${aiEnabled() ? config.ai.models.join(' → ') : 'disabled (no LLM_API_KEY)'}`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use — another FEO API is probably running.`);
      console.error(`Find it with: lsof -i :${config.port}   (or start on another port: PORT=3002 npm run dev)`);
      process.exit(1);
    }
    throw err;
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
