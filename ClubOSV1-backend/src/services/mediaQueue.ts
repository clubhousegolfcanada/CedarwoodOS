/**
 * CedarwoodOS Media Knowledge Engine - Job Queue
 *
 * BullMQ queue for async media processing (Vision AI + embedding generation).
 * Falls back to in-process async if Redis is not available.
 */

import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../utils/logger';

// Lazy import to avoid circular dependency
let processAsset: (assetId: string) => Promise<void>;

const getProcessAsset = async () => {
  if (!processAsset) {
    const { mediaProcessingService } = await import('./mediaProcessingService');
    processAsset = (id: string) => mediaProcessingService.processAsset(id);
  }
  return processAsset;
};

// Redis connection config
const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;

let mediaQueue: Queue | null = null;
let mediaWorker: Worker | null = null;

/**
 * Initialize BullMQ queue and worker if Redis is available
 */
function initializeQueue(): void {
  if (!redisUrl) {
    logger.info('No Redis URL found - media processing will use in-process async fallback');
    return;
  }

  try {
    const connection = {
      url: redisUrl,
      maxRetriesPerRequest: null, // Required by BullMQ
    };

    // Create the queue
    mediaQueue = new Queue('media-processing', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });

    // Create the worker
    mediaWorker = new Worker(
      'media-processing',
      async (job: Job) => {
        const { assetId } = job.data;
        logger.info(`[MediaQueue] Processing asset ${assetId} (attempt ${job.attemptsMade + 1})`);

        const processor = await getProcessAsset();
        await processor(assetId);

        logger.info(`[MediaQueue] Completed asset ${assetId}`);
      },
      {
        connection,
        concurrency: 3,
        limiter: {
          max: 10,
          duration: 60000, // 10 jobs per minute max (Vision API cost control)
        },
      }
    );

    mediaWorker.on('completed', (job) => {
      logger.info(`[MediaQueue] Job ${job.id} completed for asset ${job.data.assetId}`);
    });

    mediaWorker.on('failed', (job, err) => {
      logger.error(`[MediaQueue] Job ${job?.id} failed for asset ${job?.data?.assetId}:`, err.message);
    });

    mediaWorker.on('error', (err) => {
      logger.error('[MediaQueue] Worker error:', err.message);
    });

    logger.info('✅ Media processing queue initialized with Redis');
  } catch (error) {
    logger.error('[MediaQueue] Failed to initialize BullMQ, using fallback:', error);
    mediaQueue = null;
    mediaWorker = null;
  }
}

/**
 * Add a media asset to the processing queue.
 * Falls back to in-process async if Redis/BullMQ not available.
 */
export async function addMediaJob(assetId: string): Promise<void> {
  if (mediaQueue) {
    try {
      await mediaQueue.add('process-media', { assetId }, {
        jobId: `media-${assetId}`,
      });
      logger.info(`[MediaQueue] Enqueued asset ${assetId} for processing`);
      return;
    } catch (error) {
      logger.error(`[MediaQueue] Failed to enqueue ${assetId}, using fallback:`, error);
    }
  }

  // Fallback: process in-process async (fire-and-forget)
  logger.info(`[MediaQueue] Processing asset ${assetId} in-process (no Redis)`);
  setImmediate(async () => {
    try {
      const processor = await getProcessAsset();
      await processor(assetId);
      logger.info(`[MediaQueue] In-process completed for asset ${assetId}`);
    } catch (error) {
      logger.error(`[MediaQueue] In-process failed for asset ${assetId}:`, error);
    }
  });
}

/**
 * Graceful shutdown
 */
export async function shutdownMediaQueue(): Promise<void> {
  if (mediaWorker) {
    await mediaWorker.close();
    logger.info('[MediaQueue] Worker shut down');
  }
  if (mediaQueue) {
    await mediaQueue.close();
    logger.info('[MediaQueue] Queue shut down');
  }
}

// Initialize on module load
initializeQueue();

// Graceful shutdown on process exit
process.on('SIGTERM', shutdownMediaQueue);
process.on('SIGINT', shutdownMediaQueue);
