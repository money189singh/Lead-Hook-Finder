/**
 * Firebase / Google Cloud VM Background Worker Entry Point
 *
 * This process executes as an independent background daemon on:
 * - Google Cloud Compute Engine (GCE) Virtual Machine
 * - Firebase / Google Cloud Run Container
 * - Any Linux / Docker cloud host
 *
 * Capabilities:
 * - High-concurrency persistent discovery queue consumption
 * - Live Google Search / Maps grounding with Gemini & Nvidia NIM failover
 * - Deep website contact extraction (decision makers, emails, phones)
 * - Anti-bot fingerprint rotation and proxy support
 * - Continuous checkpointing and automatic lease renewal
 *
 * Run directly with:
 *   npx tsx server/worker/cloudVmWorker.ts
 * Or:
 *   npm run worker
 */

import dotenv from 'dotenv';
dotenv.config();

import { CloudWorkerEngine } from './cloudWorker';

const workerId =
  process.env.FIREBASE_WORKER_ID ||
  process.env.CLOUD_WORKER_ID ||
  process.env.GCE_INSTANCE_NAME ||
  process.env.WORKER_ID ||
  `firebase-vm-worker-${process.pid || '01'}`;

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

console.log('====================================================');
console.log(' 🚀 LeadHook Firebase / Cloud VM Discovery Worker');
console.log(` Worker ID    : ${workerId}`);
console.log(` Concurrency  : ${concurrency} parallel tasks`);
console.log(` Provider     : Google Cloud / Firebase Ecosystem`);
console.log(` Environment  : ${process.env.NODE_ENV || 'production'}`);
console.log(` Node Version : ${process.version}`);
console.log('====================================================');

const worker = new CloudWorkerEngine(workerId, concurrency);

// Start worker daemon
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
