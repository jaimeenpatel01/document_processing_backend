// ============================================================
// Webhook Utility
// Sends job completion/failure notifications to the client
// ============================================================

const axios = require('axios');
const logger = require('./logger');

/**
 * Send a webhook callback to the client's URL.
 * Non-blocking – errors are logged but never propagated.
 *
 * @param {string} webhookUrl - Client's callback URL
 * @param {Object} payload - Data to send
 */
async function sendWebhook(webhookUrl, payload) {
  if (!webhookUrl) return;

  try {
    const response = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000, // 10 second timeout
    });

    logger.info(`Webhook delivered`, {
      url: webhookUrl,
      status: response.status,
      jobId: payload.jobId,
    });
  } catch (error) {
    // Log but never throw – webhooks must not block the worker
    logger.error(`Webhook delivery failed`, {
      url: webhookUrl,
      jobId: payload.jobId,
      error: error.message,
      code: error.code,
    });
  }
}

module.exports = { sendWebhook };
