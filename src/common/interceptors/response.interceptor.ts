import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        if (body === undefined || body === null) return body;
        if (typeof body !== 'object' || Array.isArray(body)) {
          return { status: 'success', data: body };
        }
        if ('status' in body || 'data' in body) return body;
        return { status: 'success', data: body };
      }),
    );
  }
}
