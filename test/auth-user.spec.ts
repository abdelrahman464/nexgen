import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import bcrypt from 'bcryptjs';
import { validate } from 'class-validator';
import mongoose from 'mongoose';
import { AuthService } from '../src/auth/auth.service';
import { LoginDto, SignupDto } from '../src/auth/dto/auth.dto';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../src/common/guards/optional-jwt-auth.guard';
import { ImageProcessingService } from '../src/common/upload/image-processing.service';
import { UserSchema } from '../src/users/user.schema';
import * as runtimeModels from '../src/common/utils/runtime-models.util';
import jwt from 'jsonwebtoken';

const createContext = (request: any): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  }) as ExecutionContext;

describe('Auth and user core migration smoke', () => {
  const tokenService = { generateToken: jest.fn((id: string) => `token-${id}`) };
  const emailService = { send: jest.fn() };
  const usersService = {
    assertEmailAvailable: jest.fn(),
    withUploadedImages: jest.fn(async (body) => body),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    process.env.JWT_SECRET_KEY = 'test-secret';
  });

  it('logs in with valid credentials and returns the legacy token shape', async () => {
    const hashedPassword = await bcrypt.hash('password123', 12);
    const user = { _id: '66447ad7a7957a07c0ae9e69', password: hashedPassword, idDocuments: ['doc.webp'] };
    const userModel = {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(user) }),
    };
    const service = new AuthService(userModel as any, {} as any, usersService as any, emailService as any, tokenService as any);

    await expect(service.login({ email: 'user@example.com', password: 'password123' })).resolves.toEqual({
      data: { ...user, idDocuments: undefined },
      token: 'token-66447ad7a7957a07c0ae9e69',
    });
  });

  it('rejects invalid login credentials', async () => {
    const userModel = {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }),
    };
    const service = new AuthService(userModel as any, {} as any, usersService as any, emailService as any, tokenService as any);

    await expect(service.login({ email: 'user@example.com', password: 'password123' })).rejects.toThrow(
      'incorrect password or email',
    );
  });

  it('rejects protected routes without a bearer token', async () => {
    await expect(new JwtAuthGuard().canActivate(createContext({ headers: {} }))).rejects.toThrow(
      'you are not login,please login first',
    );
  });

  it('resolves protected users through typed runtime models', async () => {
    const user = {
      _id: 'user-id',
      role: 'user',
      emailVerified: true,
      active: true,
      idVerification: 'verified',
    };
    jest.spyOn(runtimeModels, 'getRuntimeUserModel').mockReturnValue({
      findById: jest.fn().mockResolvedValue(user),
    } as any);
    const token = jwt.sign({ userId: 'user-id' }, 'test-secret');
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(new JwtAuthGuard().canActivate(createContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user', user);
  });

  it('keeps the ID verification gate behavior with typed runtime models', async () => {
    const user = {
      _id: 'user-id',
      role: 'user',
      emailVerified: true,
      active: true,
      idVerification: 'pending',
    };
    jest.spyOn(runtimeModels, 'getRuntimeUserModel').mockReturnValue({
      findById: jest.fn().mockResolvedValue(user),
    } as any);
    jest.spyOn(runtimeModels, 'getRuntimeCourseProgressModel').mockReturnValue({
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            course: 'course-id',
            progress: [{ status: 'Completed' }],
          }),
        }),
      }),
    } as any);
    jest.spyOn(runtimeModels, 'getRuntimeLessonModel').mockReturnValue({
      countDocuments: jest.fn().mockResolvedValue(2),
    } as any);
    const token = jwt.sign({ userId: 'user-id' }, 'test-secret');

    await expect(
      new JwtAuthGuard().canActivate(createContext({ headers: { authorization: `Bearer ${token}` } })),
    ).rejects.toThrow('You Are Not Verified Your ID Document');
  });

  it('sets optional auth users to null for missing or invalid tokens', async () => {
    const request = { headers: {} };

    await expect(new OptionalJwtAuthGuard().canActivate(createContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user', null);
  });

  it('resolves optional auth users through typed runtime models', async () => {
    const user = { _id: 'user-id' };
    jest.spyOn(runtimeModels, 'getRuntimeUserModel').mockReturnValue({
      findById: jest.fn().mockResolvedValue(user),
    } as any);
    const token = jwt.sign({ userId: 'user-id' }, 'test-secret');
    const request = { headers: { authorization: `Bearer ${token}` } };

    await expect(new OptionalJwtAuthGuard().canActivate(createContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty('user', user);
  });

  it('blocks non-admin users through the role guard', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext({ user: { role: 'user' } }))).toThrow(
      'you are not allowed to access this route',
    );
  });

  it('rejects invalid email verification codes', async () => {
    const userModel = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = new AuthService(userModel as any, {} as any, usersService as any, emailService as any, tokenService as any);

    await expect(service.verifyEmail('123456')).rejects.toThrow('Email code invalid or expired');
  });

  it('resolves invitation keys through the typed MarketingLogs model', async () => {
    const marketLog = { marketer: 'marketer-id', role: 'affiliate', fallBackCoach: 'coach-id' };
    const marketingLogModel = {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(marketLog) }),
    };
    const service = new AuthService({} as any, marketingLogModel as any, usersService as any, emailService as any, tokenService as any);

    await expect((service as any).resolveInvitation('invite-key')).resolves.toEqual({
      invitorId: 'marketer-id',
      coachId: 'coach-id',
    });
    expect(marketingLogModel.findOne).toHaveBeenCalledWith({ invitationKeys: { $in: ['invite-key'] } });
  });

  it('rejects invalid invitation keys with the legacy message', async () => {
    const marketingLogModel = {
      findOne: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }),
    };
    const service = new AuthService({} as any, marketingLogModel as any, usersService as any, emailService as any, tokenService as any);

    await expect((service as any).resolveInvitation('bad-key')).rejects.toThrow('this link is invalid');
  });

  it('issues admin user tokens with the legacy response shape', async () => {
    const user = { _id: '66447ad7a7957a07c0ae9e69', idDocuments: ['doc.webp'] };
    const userModel = {
      findById: jest.fn().mockResolvedValue(user),
    };
    const service = new AuthService(userModel as any, {} as any, usersService as any, emailService as any, tokenService as any);

    await expect(service.adminIssueUserToken('66447ad7a7957a07c0ae9e69')).resolves.toEqual({
      data: { ...user, idDocuments: undefined },
      token: 'token-66447ad7a7957a07c0ae9e69',
    });
  });

  it('rejects invalid signup DTO data and password mismatches', async () => {
    const dto = Object.assign(new SignupDto(), {
      name: 'A',
      email: 'bad-email',
      password: 'password123',
      passwordConfirm: 'different',
      country: 'I',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'email', 'passwordConfirm', 'country']),
    );
  });

  it('rejects non-image user uploads before Sharp processing', async () => {
    const images = new ImageProcessingService();

    await expect(
      images.saveImageAsWebp({ mimetype: 'text/plain', buffer: Buffer.from('x') } as Express.Multer.File, 'users', 'profileImg'),
    ).rejects.toThrow('Unsupported file type');
  });

  it('strips sensitive fields from user JSON serialization', () => {
    const Model = mongoose.models.UserSerializationSmoke || mongoose.model('UserSerializationSmoke', UserSchema);
    const user = new Model({
      name: 'User',
      email: 'user@example.com',
      password: 'password123',
      emailVerificationCode: 'secret',
      emailVerificationExpires: new Date(),
      passwordResetCode: 'reset',
    });

    expect(user.toJSON()).not.toHaveProperty('password');
    expect(user.toJSON()).not.toHaveProperty('emailVerificationCode');
    expect(user.toJSON()).not.toHaveProperty('passwordResetCode');
  });
});
