/**
 * DigitalOcean Background Worker Entry Point
 *
 * This process executes independently on DigitalOcean to perform:
 * - Persistent discovery queue consumption
 * - Web search & directory extraction
 * - Official website identification & verification
 * - Decision-maker & email extraction
 * - Firmographics & buying signals enrichment
 * - Deduplication & periodic checkpointing
 *
 * Run directly with:
 *   npx tsx server/worker/digitalOceanWorker.ts
 * Or:
 *   npm run worker
 */

import dotenv from 'dotenv';
dotenv.config();

import { CloudWorkerEngine } from './cloudWorker';

const workerId =
  process.env.DIGITALOCEAN_WORKER_ID ||
  process.env.WORKER_ID ||
  `do-worker-${process.env.REGION || 'ams3'}-${process.pid}`;

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

console.log('====================================================');
console.log(' LeadHook DigitalOcean Cloud Discovery Worker');
console.log(` Worker ID    : ${workerId}`);
console.log(` Concurrency  : ${concurrency} parallel tasks`);
console.log(` Environment  : ${process.env.NODE_ENV || 'production'}`);
console.log(` Node Version : ${process.version}`);
console.log('====================================================');

const worker = new CloudWorkerEngine(workerId, concurrency);

// Start worker
worker.start();

// Handle graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`[Worker Process] Received ${signal}. Shutting down worker gracefully...`);
  try {
    await worker.stop();
    process.exit(0);
  } catch (err: any) {
    console.error('[Worker Process] Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[Worker Process] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Worker Process] Unhandled rejection:', reason);
});
