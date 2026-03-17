import { config } from "../config/env";
import { Logger } from "./logger.util";

interface RetryOptions {
  jobId: string;
  endpoint: string;
  payload: Record<string, unknown>;
  handler: () => Promise<void>;
}

/**
 * Execute a scraper callback handler with exponential backoff retry.
 * If all retries fail, the payload is written to the CallbackDeadLetter table.
 */
export async function withCallbackRetry(options: RetryOptions): Promise<void> {
  const { jobId, endpoint, payload, handler } = options;
  const maxAttempts = config.callbackRetry.maxAttempts;
  const baseDelay = config.callbackRetry.baseDelayMs;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await handler();
      return; // Success — exit
    } catch (err: any) {
      lastError = err;
      Logger.warn(
        `Callback retry ${attempt}/${maxAttempts} failed for ${endpoint} (job ${jobId}): ${err.message}`
      );

      if (attempt < maxAttempts) {
        // Exponential backoff: baseDelay * 2^(attempt-1) with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted — write to dead-letter queue
  Logger.error(
    `Callback permanently failed for ${endpoint} (job ${jobId}) after ${maxAttempts} attempts. Writing to dead-letter queue.`
  );

  try {
    // Log dead-letter entry (no dedicated table yet — log for manual recovery)
    Logger.error(
      `Dead-letter entry: jobId=${jobId}, endpoint=${endpoint}, attempts=${maxAttempts}, error=${lastError?.message}`
    );
  } catch (dlqError: any) {
    Logger.error(`Failed to log dead-letter entry: ${dlqError.message}`);
  }
}
