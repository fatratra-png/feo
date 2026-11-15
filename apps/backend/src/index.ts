import { createApp } from './app';
import { aiEnabled, config } from './config';
import { migrate } from './migrate';
import { warmStarters } from './services/ai';

async function main() {
  await migrate();

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`FEO API → http://localhost:${config.port}/api`);
    console.log(`AI: ${aiEnabled() ? config.ai.models.join(' → ') : 'disabled (no LLM_API_KEY)'}`);
    warmStarters();
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
