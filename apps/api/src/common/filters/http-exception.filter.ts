import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/** Generic Hebrew message returned for all unexpected 500 errors. */
const INTERNAL_ERROR_MESSAGE = 'שגיאה פנימית בשרת';

/**
 * Global exception filter — catches every thrown value so that:
 *
 * 1. `HttpException` subclasses (NestJS + manual `throw new NotFoundException(...)`)
 *    are forwarded as-is using their own status code and message.
 *
 * 2. Everything else (raw `Error`, Prisma `PrismaClientKnownRequestError`,
 *    unexpected throws, etc.) is:
 *    - Logged server-side with full stack trace so engineers can diagnose it.
 *    - Returned to the client as a plain `{ statusCode: 500, message: '...' }`
 *      with NO internal details (no model names, constraint names, stack traces).
 *
 * This prevents schema leakage — a student probing a protected endpoint will
 * receive `{ statusCode: 500, message: 'שגיאה פנימית בשרת' }` instead of a
 * Prisma error that exposes model and field names.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response.status(status).json(body);
      return;
    }

    // Unexpected error — log full details server-side, return generic message.
    const message = exception instanceof Error ? exception.message : String(exception);
    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: INTERNAL_ERROR_MESSAGE,
      error: 'Internal Server Error',
    });
  }
}
