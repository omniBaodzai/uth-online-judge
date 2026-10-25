export class Judge0Error extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class Judge0ConfigError extends Judge0Error {}
export class Judge0UnavailableError extends Judge0Error {}
export class Judge0TimeoutError extends Judge0Error {}
export class Judge0SubmissionTimeoutError extends Judge0TimeoutError {}
export class Judge0InfrastructureError extends Judge0Error {}
export class Judge0InvalidResponseError extends Judge0Error {}
