import { Judge0Config } from './judge0.config.js';
import {
  Judge0InvalidResponseError,
  Judge0TimeoutError,
  Judge0UnavailableError,
} from './judge0.errors.js';

export type FetchFn = typeof fetch;

// Thin HTTP wrapper: handles timeouts, network failures, non-2xx and non-JSON bodies.
export class Judge0Client {
  constructor(
    private readonly config: Pick<Judge0Config, 'baseUrl' | 'requestTimeoutMs'>,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.config.baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new Judge0TimeoutError(`Judge0 did not respond within ${this.config.requestTimeoutMs}ms.`, { cause: error });
      }
      throw new Judge0UnavailableError('Cannot reach Judge0.', { cause: error });
    }

    if (!response.ok) {
      throw new Judge0UnavailableError(`Judge0 responded with HTTP ${response.status}.`);
    }
    try {
      return await response.json();
    } catch (error) {
      throw new Judge0InvalidResponseError('Judge0 returned a non-JSON response.', { cause: error });
    }
  }
}
