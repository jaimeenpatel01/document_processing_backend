// ============================================================
// Job Controller
// Handles HTTP request/response for job endpoints
// ============================================================

const { validationResult } = require('express-validator');
const JobService = require('../services/jobService');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class JobController {
  /**
   * POST /jobs
   * Create a new document processing job.
   */
  static async createJob(req, res, next) {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map((e) => ({
            field: e.path,
            message: e.msg,
          })),
        });
      }

      const { fileUrl, webhookUrl } = req.body;
      const job = await JobService.createJob({ fileUrl, webhookUrl });

      logger.info(`POST /jobs → 201`, { jobId: job.id });

      return res.status(201).json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          createdAt: job.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /jobs/:id
   * Retrieve a single job by ID.
   */
  static async getJob(req, res, next) {
    try {
      const { id } = req.params;

      // Basic UUID format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new AppError('Invalid job ID format. Must be a valid UUID.', 400);
      }

      const job = await JobService.getJobById(id);

      return res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /jobs
   * List jobs with pagination and optional status filter.
   */
  static async listJobs(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const { status } = req.query;

      // Validate status if provided
      const validStatuses = ['queued', 'processing', 'completed', 'failed'];
      if (status && !validStatuses.includes(status)) {
        throw new AppError(
          `Invalid status filter. Must be one of: ${validStatuses.join(', ')}`,
          400,
        );
      }

      const result = await JobService.listJobs({ page, limit, status });

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = JobController;
