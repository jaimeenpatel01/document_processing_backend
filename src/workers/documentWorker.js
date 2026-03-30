// ============================================================
// Document Processing Worker
// Separate process that consumes jobs from the BullMQ queue
// ============================================================

require('dotenv').config();

const { Worker } = require('bullmq');
const { createRedisConnection } = require('../db/redisConnection');
const prisma = require('../db/prismaClient');
const { sendWebhook } = require('../utils/webhook');
const logger = require('../utils/logger');

const QUEUE_NAME = process.env.QUEUE_NAME || 'document-processing';
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY, 10) || 5;

// ── Processing Logic ───────────────────────────────────────

/**
 * Simulates document processing with a random delay (10–20 seconds).
 * In production, this would call actual parsing / OCR / AI services.
 *
 * @param {string} fileUrl - URL of the file being processed
 * @returns {Object} Mock result
 */
async function processDocument(fileUrl) {
  const delayMs = (Math.floor(Math.random() * 11) + 10) * 1000; // 10–20s
  logger.info(`Processing document (simulated ${delayMs / 1000}s delay)`, { fileUrl });

  await new Promise((resolve) => setTimeout(resolve, delayMs));

  // Generate mock result
  return {
    summary: 'Document processed successfully',
    pages: Math.floor(Math.random() * 20) + 1,
    fileUrl,
    processedAt: new Date().toISOString(),
    metadata: {
      format: 'PDF',
      sizeKb: Math.floor(Math.random() * 5000) + 100,
      language: 'en',
    },
  };
}

// ── Worker Setup ───────────────────────────────────────────

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { jobId, fileUrl, webhookUrl } = job.data;

    logger.info(`▶ Worker picked up job`, {
      jobId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts,
    });

    // 1. Mark job as "processing"
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'processing',
        startedAt: new Date(),
        retryCount: job.attemptsMade,
      },
    });

    // 2. Process the document
    const result = await processDocument(fileUrl);

    // 3. Mark job as "completed"
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        result,
        completedAt: new Date(),
      },
    });

    logger.info(`✅ Job completed`, { jobId });

    // 4. Fire webhook (non-blocking)
    await sendWebhook(webhookUrl, {
      jobId,
      status: 'completed',
      result,
    });

    return result;
  },
  {
    connection: createRedisConnection(),
    concurrency: CONCURRENCY,
    limiter: {
      max: 10,
      duration: 1000,
    },
  },
);

// ── Worker Event Handlers ──────────────────────────────────

worker.on('completed', (job) => {
  logger.info(`🏁 BullMQ job completed`, { bullmqJobId: job.id });
});

worker.on('failed', async (job, error) => {
  const { jobId, webhookUrl } = job.data;
  const isMaxRetries = job.attemptsMade >= job.opts.attempts;

  logger.error(`❌ Job failed`, {
    jobId,
    attempt: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    error: error.message,
    willRetry: !isMaxRetries,
  });

  if (isMaxRetries) {
    // Mark as permanently failed in DB
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: error.message,
          retryCount: job.attemptsMade,
          completedAt: new Date(),
        },
      });

      // Notify client of failure via webhook
      await sendWebhook(webhookUrl, {
        jobId,
        status: 'failed',
        error: error.message,
      });
    } catch (dbError) {
      logger.error(`Failed to update job in DB after max retries`, {
        jobId,
        error: dbError.message,
      });
    }
  }
});

worker.on('error', (error) => {
  logger.error('Worker error:', error);
});

// ── Graceful Shutdown ──────────────────────────────────────

async function shutdown(signal) {
  logger.info(`${signal} received – shutting down worker gracefully...`);

  await worker.close();
  await prisma.$disconnect();

  logger.info('Worker shut down cleanly.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info(`🔧 Worker started (concurrency: ${CONCURRENCY}, queue: "${QUEUE_NAME}")`);
