import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';

const User = require('../../../models/userModel');

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers?.authorization;
    const token = authorization && authorization.startsWith('Bearer') ? authorization.split(' ')[1] : null;

    if (!token) {
      request.user = null;
      return true;
    }

    try {
      const secret = process.env.JWT_SECRET_KEY;
      if (!secret) throw new Error('JWT_SECRET_KEY is required');
      const decoded = jwt.verify(token, secret) as { userId: string };
      request.user = await User.findById(decoded.userId);
    } catch (_error) {
      request.user = null;
    }
    return true;
  }
}
