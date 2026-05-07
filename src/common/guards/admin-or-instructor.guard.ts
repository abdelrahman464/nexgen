import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiException } from '../exceptions/api.exception';

@Injectable()
export class AdminOrInstructorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (user?.role === 'admin' || user?.isInstructor) return true;
    throw new ApiException('You are not authorized to access this route', 404);
  }
}
