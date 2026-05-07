import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { logRuntimeErrorToDatabase } from '../utils/runtime-models.util';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const legacyStatusCode =
      typeof (exception as { statusCode?: unknown })?.statusCode === 'number'
        ? ((exception as { statusCode: number }).statusCode)
        : undefined;
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : legacyStatusCode
          ? legacyStatusCode
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.getMessage(exception);
    const status = statusCode >= 500 ? 'error' : 'fail';

    if (process.env.SKIP_DB_CONNECTION !== 'true' && process.env.NODE_ENV !== 'test') {
      try {
        const url = request ? `${request.method} ${request.originalUrl || request.url}` : null;
        await logRuntimeErrorToDatabase(exception, url);
      } catch (logError) {
        console.error('Failed to log error to database:', logError);
      }
    }

    const payload: Record<string, unknown> = { status, message };
    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      payload.error = exception;
      payload.stack = exception.stack;
    }

    response.status(statusCode).json(payload);
  }

  private getMessage(exception: unknown) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message: unknown }).message;
        return Array.isArray(message) ? message.join(', ') : String(message);
      }
    }
    if (exception instanceof Error) return exception.message;
    return 'Internal server error';
  }
}
