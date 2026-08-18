export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  isRetryable: (error: unknown) => boolean;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === options.maxAttempts;
      if (isLastAttempt || !options.isRetryable(error)) {
        throw error;
      }
      const delayMs = options.baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
