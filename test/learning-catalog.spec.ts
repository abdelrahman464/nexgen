import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { CatalogQueryService } from '../src/learning-catalog/catalog-query.service';
import { CatalogReorderService } from '../src/learning-catalog/catalog-reorder.service';
import { CreatePackageDto, ReorderItemsDto } from '../src/learning-catalog/dto/learning-catalog.dto';

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
});
