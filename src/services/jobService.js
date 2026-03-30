// ============================================================
// Job Service
// Business logic layer for job CRUD and queue interaction
// ============================================================

const prisma = require('../db/prismaClient');
const { documentQueue } = require('../queues/documentQueue');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');

class JobService {
  /**
   * Create a new document processing job.
   * Persists to PostgreSQL and enqueues to BullMQ.
   */
  static async createJob({ fileUrl, webhookUrl }) {
    // 1. Persist job to database
    const job = await prisma.job.create({
      data: {
        fileUrl,
        webhookUrl: webhookUrl || null,
        status: 'queued',
        retryCount: 0,
      },
    });

    logger.info(`Job created in DB`, { jobId: job.id, fileUrl });

    // 2. Enqueue job for async processing
    await documentQueue.add('process-document', {
      jobId: job.id,
      fileUrl: job.fileUrl,
      webhookUrl: job.webhookUrl,
    }, {
      jobId: job.id, // use DB id as BullMQ job id for traceability
    });

    logger.info(`Job enqueued`, { jobId: job.id });

    return job;
  }

  /**
   * Retrieve a single job by ID.
   */
  static async getJobById(id) {
    const job = await prisma.job.findUnique({ where: { id } });

    if (!job) {
      throw new AppError(`Job not found: ${id}`, 404);
    }

    return job;
  }

  /**
   * List jobs with pagination and optional status filter.
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number (1-based)
   * @param {number} params.limit - Items per page
   * @param {string} [params.status] - Filter by status
   */
  static async listJobs({ page = 1, limit = 10, status }) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update a job's status and optional fields.
   * Used by the worker process.
   */
  static async updateJob(id, data) {
    const job = await prisma.job.update({
      where: { id },
      data,
    });

    logger.info(`Job updated`, { jobId: id, status: job.status });
    return job;
  }
}

module.exports = JobService;
