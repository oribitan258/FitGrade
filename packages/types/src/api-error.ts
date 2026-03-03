/**
 * Typed API error thrown by the api.ts fetch wrapper in both apps.
 *
 * Extends Error so React Query and error boundaries receive a proper
 * Error instance with a stack trace (plain objects lose the stack trace).
 *
 * Shape mirrors the NestJS global exception filter response:
 *   { statusCode, message, error }
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly error: string;

  constructor(statusCode: number, message: string, error: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.error = error;
  }
}
