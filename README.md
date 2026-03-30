# 📄 Asynchronous Document Processing API

A production-quality **Node.js backend system** for asynchronous document processing, built with Express, BullMQ, Redis, PostgreSQL, and Prisma ORM.

---

## 🏗️ Architecture

```
                     ┌─────────────────────────┐
                     │     Client / cURL        │
                     └────────┬────────────────┘
                              │  HTTP
                              ▼
                     ┌─────────────────────────┐
                     │   Express API Server     │
                     │   (POST /jobs, GET ...)  │
                     └────┬──────────┬─────────┘
                          │          │
                    Write │          │ Enqueue
                          ▼          ▼
               ┌──────────────┐  ┌──────────────┐
               │  PostgreSQL  │  │    Redis      │
               │   (Prisma)   │  │  (BullMQ)     │
               └──────────────┘  └──────┬───────┘
                          ▲              │ Dequeue
                          │              ▼
                          │     ┌─────────────────────────┐
                    Update│     │   Worker Process         │
                          │     │   (concurrency: 5)       │
                          └─────┤   - Simulates processing │
                                │   - Updates DB status    │
                                │   - Fires webhooks       │
                                └─────────────────────────┘
```

## 💡 Assumptions & Design Decisions

### Assumptions
- **Publicly Accessible Document URLs**: The `fileUrl` provided in the request is assumed to be publicly accessible without requiring authentication or cookies.
- **Simulated Processing**: The actual "processing" step is simulated using a random 10-20 second artificial delay and returns a mocked result payload. No real file downloading or OCR/parsing happens.
- **Webhook Delivery Constraints**: Webhook delivery assumes the client’s endpoint will respond within a 10-second timeout. Webhooks are executed via a fire-and-forget strategy; failures do not block the worker or change the job's "completed" status.
- **Infrastructure Scope**: PostgreSQL serves as the persistent source of truth, whereas Redis is strictly used as an ephemeral message broker and queue state manager.

### Design Decisions Note
This system employs the **Queue + Worker** architecture, an industry standard for asynchronous tasks that would normally block HTTP request cycles. 

- **Worker Process Isolation**: The Express API layer handles request validation and queue ingestion instantly, delegating all processing to a completely decoupled worker process. This allows independent scaling of workers based on throughput needs without affecting API response times.
- **Database-First Persistence**: Jobs are saved to PostgreSQL *before* being enqueued in Redis. If Redis goes down, the job records still exist securely in the database.
- **Choice of BullMQ**: BullMQ was chosen over simpler queues due to its robust native features including exponential backoff, connection resiliency, and built-in concurrency controls.
- **Error Tolerance**: The document processing pipeline relies on a configured retry mechanism (up to 3 attempts) for transient failures. If the job fails entirely, it is safely marked as "failed" in the database with the associated error message.

---

## 📁 Project Structure

```
src/
├── app.js                      # Express server entry point
├── controllers/
│   └── jobController.js        # HTTP request handlers
├── routes/
│   └── jobRoutes.js            # Route definitions + validation
├── services/
│   └── jobService.js           # Business logic layer
├── queues/
│   └── documentQueue.js        # BullMQ queue configuration
├── workers/
│   └── documentWorker.js       # Separate worker process
├── db/
│   ├── prismaClient.js         # Prisma singleton
│   └── redisConnection.js      # Redis connection factory
└── utils/
    ├── logger.js               # Winston logger
    ├── errorHandler.js         # Centralized error handling
    └── webhook.js              # Webhook delivery utility
```

---

## 🚀 Quick Start (Docker)

### Prerequisites
- Docker & Docker Compose installed

### Run

```bash
# Clone the repo and navigate to the project
cd "Client Backend"

# Start all services
docker-compose up --build

# The API is now available at http://localhost:3000
```

### Stop

```bash
docker-compose down

# To also remove volumes (data):
docker-compose down -v
```

---

## 🛠️ Local Development (Without Docker)

### Prerequisites
- Node.js ≥ 18
- PostgreSQL running locally
- Redis running locally

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env  # or edit .env directly

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Start the API server
npm run dev

# In a separate terminal, start the worker
npm run worker:dev
```

---

## 📡 API Reference

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-29T14:00:00.000Z",
  "uptime": 123.456
}
```

---

### Create Job

```
POST /jobs
Content-Type: application/json
```

**Request Body:**
```json
{
  "fileUrl": "https://example.com/file.pdf",
  "webhookUrl": "https://client.com/webhook"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "queued",
    "createdAt": "2026-03-29T14:00:00.000Z"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "fileUrl": "https://example.com/report.pdf",
    "webhookUrl": "https://webhook.site/your-uuid"
  }'
```

---

### Get Job Status

```
GET /jobs/:id
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "fileUrl": "https://example.com/file.pdf",
    "status": "completed",
    "result": {
      "summary": "Document processed successfully",
      "pages": 5,
      "fileUrl": "https://example.com/file.pdf",
      "processedAt": "2026-03-29T14:00:15.000Z",
      "metadata": {
        "format": "PDF",
        "sizeKb": 2450,
        "language": "en"
      }
    },
    "error": null,
    "webhookUrl": "https://client.com/webhook",
    "createdAt": "2026-03-29T14:00:00.000Z",
    "startedAt": "2026-03-29T14:00:01.000Z",
    "completedAt": "2026-03-29T14:00:15.000Z",
    "retryCount": 0
  }
}
```

---

### List Jobs

```
GET /jobs?page=1&limit=10&status=completed
```

**Query Parameters:**

| Param    | Type   | Default | Description                                      |
| -------- | ------ | ------- | ------------------------------------------------ |
| `page`   | number | 1       | Page number (1-based)                             |
| `limit`  | number | 10      | Items per page (max 100)                          |
| `status` | string | —       | Filter: `queued`, `processing`, `completed`, `failed` |

**Response (200):**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

---

## 🔄 Job Lifecycle

```
  POST /jobs
      │
      ▼
  ┌──────────┐     enqueue     ┌──────────────┐
  │  queued   │ ──────────────► │  BullMQ      │
  └──────────┘                  │  Redis Queue  │
                                └──────┬───────┘
                                       │ worker picks up
                                       ▼
                                ┌──────────────┐
                                │  processing  │
                                └──────┬───────┘
                              ┌────────┴────────┐
                         success              failure
                              ▼                    ▼
                        ┌───────────┐      retry? ──► back to queue
                        │ completed │        │
                        └───────────┘   max retries?
                                              ▼
                                        ┌──────────┐
                                        │  failed   │
                                        └──────────┘
```

---

## 🔧 Configuration

All configuration is via environment variables:

| Variable             | Default               | Description                        |
| -------------------- | --------------------- | ---------------------------------- |
| `PORT`               | `3000`                | API server port                    |
| `NODE_ENV`           | `development`         | Environment mode                   |
| `DATABASE_URL`       | —                     | PostgreSQL connection string       |
| `REDIS_HOST`         | `localhost`            | Redis hostname                     |
| `REDIS_PORT`         | `6379`                | Redis port                         |
| `QUEUE_NAME`         | `document-processing` | BullMQ queue name                  |
| `WORKER_CONCURRENCY` | `5`                   | Max parallel jobs per worker       |
| `LOG_LEVEL`          | `info`                | Winston log level                  |

---

## 🐳 Docker Services

| Service    | Image           | Port | Description                   |
| ---------- | --------------- | ---- | ----------------------------- |
| `api`      | Custom (Node)   | 3000 | Express API server            |
| `worker`   | Custom (Node)   | —    | BullMQ worker process         |
| `postgres` | postgres:16     | 5432 | PostgreSQL database           |
| `redis`    | redis:7         | 6379 | Redis (queue broker)          |

---
