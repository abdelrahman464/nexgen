import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { CatalogQueryService } from '../src/learning-catalog/catalog-query.service';
import { CatalogReorderService } from '../src/learning-catalog/catalog-reorder.service';
import { CatalogAccessService } from '../src/learning-catalog/catalog-access.service';
import { CreatePackageDto, ReorderItemsDto } from '../src/learning-catalog/dto/learning-catalog.dto';
import { LearningCatalogService } from '../src/learning-catalog/learning-catalog.service';
import { createMulterOptions } from '../src/common/upload/upload.helper';

describe('Learning catalog package migration smoke', () => {
  it('rejects invalid package create DTO input', async () => {
    const dto = Object.assign(new CreatePackageDto(), {
      category: 'bad-id',
      status: 'deleted',
      price: 'not-number',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['category', 'status', 'price']),
    );
  });

  it('rejects duplicate reorder ids and order values', async () => {
    const id = new Types.ObjectId().toString();
    const service = new CatalogReorderService();
    const model = { bulkWrite: jest.fn() };

    await expect(
      service.updateItemsOrder(model as any, [
        { id, order: 1 },
        { id, order: 1 },
      ]),
    ).rejects.toThrow('Duplicate item ids are not allowed');
  });

  it('accepts valid reorder items and updates in bulk', async () => {
    const service = new CatalogReorderService();
    const model = { bulkWrite: jest.fn().mockResolvedValue({}) };
    const first = new Types.ObjectId().toString();
    const second = new Types.ObjectId().toString();

    await expect(
      service.updateItemsOrder(model as any, [
        { id: first, order: 1 },
        { id: second, order: 2 },
      ]),
    ).resolves.toEqual({ status: 'success', message: 'Items reordered successfully' });
    expect(model.bulkWrite).toHaveBeenCalledWith([
      { updateOne: { filter: { _id: first }, update: { $set: { order: 1 } } } },
      { updateOne: { filter: { _id: second }, update: { $set: { order: 2 } } } },
    ]);
  });

  it('keeps public package filters active by default', () => {
    const service = new CatalogQueryService();
    const filter = service.applyCatalogFilters({ keyword: 'math' }, { status: 'active' }, false);

    expect(filter.status).toBe('active');
    expect(filter.$or).toHaveLength(4);
  });

  it('validates reorder DTO shape', async () => {
    const dto = Object.assign(new ReorderItemsDto(), { items: [] });

    await expect(validate(dto)).resolves.toHaveLength(1);
  });

  it('uses the current authenticated user when resolving certificate links', async () => {
    const courseProgressModel = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = new LearningCatalogService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      courseProgressModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.getCertificateLink('66447ad7a7957a07c0ae9e69', { _id: '66447ad7a7957a07c0ae9e70' });

    expect(courseProgressModel.findOne).toHaveBeenCalledWith({
      user: '66447ad7a7957a07c0ae9e70',
      course: '66447ad7a7957a07c0ae9e69',
      'certificate.file': { $exists: true, $ne: null },
    });
  });

  it('blocks non-owner instructors from course mutations', async () => {
    const courseModel = {
      findById: jest.fn().mockResolvedValue({ instructor: '66447ad7a7957a07c0ae9e71' }),
    };
    const access = new CatalogAccessService(courseModel as any, {} as any, {} as any, {} as any, {} as any);

    await expect(
      access.assertAdminOrCourseInstructor(
        { _id: '66447ad7a7957a07c0ae9e70', role: 'user', isInstructor: true },
        '66447ad7a7957a07c0ae9e69',
      ),
    ).rejects.toThrow('You are not the instructor of this course');
  });

  it('rejects unsupported lesson upload MIME types through the shared upload guard', () => {
    const options = createMulterOptions();
    const callback = jest.fn();

    options.fileFilter({}, { mimetype: 'application/javascript' }, callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
  });

  it('scores lesson exam submissions and updates course progress', async () => {
    const lessonId = new Types.ObjectId().toString();
    const courseId = new Types.ObjectId();
    const questionId = new Types.ObjectId();
    const examModel = {
      findOne: jest.fn().mockResolvedValue({
        passingScore: 70,
        questions: [{ _id: questionId, correctOption: 1, grade: 1 }],
      }),
    };
    const lessonModel = { findById: jest.fn().mockResolvedValue({ course: courseId }) };
    const courseProgressModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };
    const service = new LearningCatalogService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      lessonModel as any,
      courseProgressModel as any,
      examModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.submitExam('lesson', lessonId, { _id: '66447ad7a7957a07c0ae9e70' }, [
        { question: questionId.toString(), answer: 1 },
      ]),
    ).resolves.toMatchObject({ status: 'success', data: { score: 100, status: 'Completed' } });
    expect(courseProgressModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('blocks analytics performance reads for unrelated users', async () => {
    const service = new LearningCatalogService(
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
      {} as any,
      {} as any,
    );

    await expect(
      service.getAnalyticsPerformance('66447ad7a7957a07c0ae9e69', {
        _id: '66447ad7a7957a07c0ae9e70',
        role: 'user',
      }),
    ).rejects.toThrow('Not authorized');
  });
});
