import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class OptionalLegacyAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authServices = require('../../../services/authServices');
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    await new Promise<void>((resolve) => {
      authServices.optionalAuth(req, res, () => resolve());
    });

    return true;
  }
}
