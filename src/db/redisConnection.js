// ============================================================
// Redis Connection Configuration
// Shared IORedis connection used by BullMQ queue and worker
// ============================================================

const IORedis = require('ioredis');
const logger = require('../utils/logger');

/**
 * Creates a new Redis connection with retry logic.
 * BullMQ requires dedicated connections (no sharing between queue & worker).
 */
function createRedisConnection() {
  const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      logger.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
      return delay;
    },
  });

  connection.on('connect', () => logger.info('✅ Redis connected'));
  connection.on('error', (err) => logger.error('❌ Redis error:', err.message));

  return connection;
}

module.exports = { createRedisConnection };
