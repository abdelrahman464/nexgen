import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { validate } from 'class-validator';
import request from 'supertest';
import { setupNestApp } from '../src/app.setup';
import { ParseObjectIdPipe } from '../src/common/pipes/parse-object-id.pipe';
import { createMulterOptions } from '../src/common/upload/upload.helper';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { NotificationsController } from '../src/foundation-data/foundation-data.controller';
import { CreateContactUsDto } from '../src/foundation-data/dto/foundation-data.dto';
import { FoundationDataService } from '../src/foundation-data/foundation-data.service';

describe('Foundation data migration smoke', () => {
  it('rejects invalid ContactUs DTO input', async () => {
    const dto = Object.assign(new CreateContactUsDto(), {
      name: '1',
      email: 'not-an-email',
      message: 'bad',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'email', 'message']),
    );
  });

  it('validates Mongo object ids through the shared pipe', () => {
    const pipe = new ParseObjectIdPipe();

    expect(pipe.transform('66447ad7a7957a07c0ae9e69')).toBe(
      '66447ad7a7957a07c0ae9e69',
    );
    expect(() => pipe.transform('bad-id')).toThrow('Invalid ID format');
  });

  it('rejects unsupported upload MIME types', () => {
    const options = createMulterOptions();
    const callback = jest.fn();

    options.fileFilter(
      {},
      { mimetype: 'text/plain' },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
  });

  it('resolves notifications unreadCount before :id routes', async () => {
    const service = {
      getUnreadNotificationCount: jest.fn().mockResolvedValue({ count: 7 }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: FoundationDataService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = {
            _id: '66447ad7a7957a07c0ae9e69',
            role: 'user',
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const app: INestApplication = moduleRef.createNestApplication();
    setupNestApp(app);
    await app.init();

    await request(app.getHttpServer())
      .get('/api/v1/notifications/unreadCount')
      .expect(200)
      .expect(({ body }) => {
        expect(body.count).toBe(7);
      });

    expect(service.getUnreadNotificationCount).toHaveBeenCalled();
    await app.close();
  });
});
