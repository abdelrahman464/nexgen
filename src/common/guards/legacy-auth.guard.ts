import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class LegacyAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authServices = require('../../../services/authServices');
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    await new Promise<void>((resolve, reject) => {
      authServices.protect(req, res, (error: unknown) => {
        if (error) return reject(error);
        return resolve();
      });
    });

    if (!req.user) {
      throw new UnauthorizedException('you are not login,please login first');
    }
    return true;
  }
}
