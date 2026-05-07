import { BadRequestException, Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';

@Injectable()
export class CatalogReorderService {
  async assignNextOrder(model: Model<any>, body: Record<string, any>) {
    if (body.order !== undefined && body.order !== '') return body;
    const lastOrderedDocument = await model.findOne().sort('-order').select('order').setOptions({ skipPopulate: true }).lean();
    return { ...body, order: (lastOrderedDocument?.order || 0) + 1 };
  }

  async getReorderItems(model: Model<any>) {
    const documents = await model
      .find()
      .select('_id title image status category order')
      .setOptions({ skipPopulate: true })
      .populate({ path: 'category', select: 'title' })
      .sort('order -createdAt');
    const data = documents.map((document: any) => ({
      _id: document._id,
      title: document.title,
      image: document.image,
      status: document.status,
      category: document.category,
      order: document.order || 0,
    }));
    return { results: data.length, data };
  }

  async updateItemsOrder(model: Model<any>, items: { id: string; order: number }[]) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }
    const ids = new Set<string>();
    const orders = new Set<number>();
    for (const item of items) {
      if (!item || !Types.ObjectId.isValid(item.id)) {
        throw new BadRequestException('Each item must include a valid id');
      }
      const order = Number(item.order);
      if (!Number.isInteger(order) || order < 1) {
        throw new BadRequestException('Each item order must be a positive integer');
      }
      if (ids.has(item.id)) throw new BadRequestException('Duplicate item ids are not allowed');
      if (orders.has(order)) throw new BadRequestException('Duplicate order values are not allowed');
      ids.add(item.id);
      orders.add(order);
    }
    await model.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { order: Number(item.order) } },
        },
      })),
    );
    return { status: 'success', message: 'Items reordered successfully' };
  }
}
