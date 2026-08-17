/**
 * queue.service.js
 * ─────────────────────────────────────────────────────────────────
 * Lightweight in-memory queue & concurrency rate-limiter for AI requests.
 * Manages request concurrency, queues pending tasks, and handles retries with backoff.
 * ─────────────────────────────────────────────────────────────────
 */

class AiQueueService {
    constructor(concurrency = 3, maxRetries = 3) {
        this.concurrency = concurrency;
        this.maxRetries = maxRetries;
        this.running = 0;
        this.queue = [];
    }

    /**
     * Enqueue an async task function to run with concurrency control and automatic retries.
     * @param {Function} taskFn - () => Promise<any>
     * @returns {Promise<any>}
     */
    async enqueue(taskFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ taskFn, resolve, reject, retries: 0 });
            this.next();
        });
    }

    async next() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        this.running++;
        const item = this.queue.shift();

        try {
            const result = await item.taskFn();
            item.resolve(result);
        } catch (error) {
            // Check if error is rate limit (429) or temporary server error (5xx)
            const isRateLimitOrServerErr = error?.status === 429 || (error?.status >= 500 && error?.status < 600);

            if (isRateLimitOrServerErr && item.retries < this.maxRetries) {
                item.retries++;
                const backoffMs = Math.pow(2, item.retries) * 1000;
                console.warn(`[AI Queue] Request rate limited or failed (status ${error?.status}). Retrying in ${backoffMs}ms (attempt ${item.retries}/${this.maxRetries})...`);
                
                setTimeout(() => {
                    this.queue.push(item);
                    this.running--;
                    this.next();
                }, backoffMs);
                return;
            }

            item.reject(error);
        } finally {
            if (!this.queue.includes(item)) {
                this.running--;
                this.next();
            }
        }
    }

    getStatus() {
        return {
            running: this.running,
            pending: this.queue.length,
            concurrency: this.concurrency
        };
    }
}

export const aiQueue = new AiQueueService(3, 3);
export default aiQueue;
