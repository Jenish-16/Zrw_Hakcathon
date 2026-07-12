import { createApp } from './app';
import { env } from './lib/env';

async function main() {
  const app = createApp();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`\n  ⚡ AssetFlow API running on http://localhost:${env.port}`);
    console.log(`     Health check: http://localhost:${env.port}/api/health\n`);
  });

  const shutdown = () => {
    // eslint-disable-next-line no-console
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  process.exit(1);
});
