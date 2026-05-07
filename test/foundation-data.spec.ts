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
import { ReviewSchema } from '../src/foundation-data/foundation-data.schemas';
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

  it('uses injected course progress model when enforcing system review access', async () => {
    const courseProgressModel = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new FoundationDataService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      courseProgressModel as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.createSystemReview({ ratings: 5 }, { _id: 'user-id' })).rejects.toThrow('You are not allowed to review');
    expect(courseProgressModel.findOne).toHaveBeenCalledWith({ user: 'user-id' });
  });

  it('uses the active schema connection model when recalculating review ratings', async () => {
    const updateCourse = jest.fn().mockResolvedValue({});
    const fakeReviewModel = {
      aggregate: jest.fn().mockResolvedValue([{ _id: 'course-id', ratingsQuantity: 2, avgRatings: 4.5 }]),
      db: { model: jest.fn().mockReturnValue({ findByIdAndUpdate: updateCourse }) },
    };

    await (ReviewSchema.statics as any).calcAverageRatingsAndQuantity.call(fakeReviewModel, 'course-id');

    expect(fakeReviewModel.db.model).toHaveBeenCalledWith('Course');
    expect(updateCourse).toHaveBeenCalledWith('course-id', { ratingsAverage: 4.5, ratingsQuantity: 2 });
  });
});
