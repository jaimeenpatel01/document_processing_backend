// ============================================================
// Job Routes
// Express router for all /jobs endpoints
// ============================================================

const { Router } = require('express');
const { body } = require('express-validator');
const JobController = require('../controllers/jobController');

const router = Router();

// ── Validation rules ───────────────────────────────────────
const createJobValidation = [
  body('fileUrl')
    .notEmpty().withMessage('fileUrl is required')
    .isURL().withMessage('fileUrl must be a valid URL'),
  body('webhookUrl')
    .optional()
    .isURL().withMessage('webhookUrl must be a valid URL'),
];

// ── Route definitions ──────────────────────────────────────

/**
 * POST /jobs
 * Create a new document processing job.
 */
router.post('/', createJobValidation, JobController.createJob);

/**
 * GET /jobs
 * List all jobs with pagination and optional status filter.
 * Query params: page (default 1), limit (default 10), status
 */
router.get('/', JobController.listJobs);

/**
 * GET /jobs/:id
 * Retrieve a single job by ID.
 */
router.get('/:id', JobController.getJob);

module.exports = router;
