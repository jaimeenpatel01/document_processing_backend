// ============================================================
// BullMQ Queue Setup
// Document processing queue with retry & backoff configuration
// ============================================================

const { Queue } = require('bullmq');
const { createRedisConnection } = require('../db/redisConnection');
const logger = require('../utils/logger');

const QUEUE_NAME = process.env.QUEUE_NAME || 'document-processing';

const documentQueue = new Queue(QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000, // 3s → 6s → 12s
    },
    removeOnComplete: {
      age: 86400,  // keep completed jobs for 24 hours
      count: 1000, // keep at most 1000 completed jobs
    },
    removeOnFail: {
      age: 604800, // keep failed jobs for 7 days
    },
  },
});

logger.info(`📦 Queue "${QUEUE_NAME}" initialized`);

module.exports = { documentQueue, QUEUE_NAME };
