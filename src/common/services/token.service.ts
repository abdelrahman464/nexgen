import { Injectable } from '@nestjs/common';
import jwt, { SignOptions } from 'jsonwebtoken';

@Injectable()
export class TokenService {
  generateToken(userId: string) {
    const secret = process.env.JWT_SECRET_KEY;
    if (!secret) throw new Error('JWT_SECRET_KEY is required');
    const options: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRE_TIME || '90d') as SignOptions['expiresIn'],
    };
    return jwt.sign({ userId }, secret, options);
  }
}
