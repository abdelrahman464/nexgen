const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

exports.assignNextOrder = (Model) =>
  asyncHandler(async (req, res, next) => {
    if (req.body.order !== undefined && req.body.order !== '') {
      return next();
    }

    const lastOrderedDocument = await Model.findOne()
      .sort('-order')
      .select('order')
      .setOptions({ skipPopulate: true })
      .lean();

    req.body.order = (lastOrderedDocument?.order || 0) + 1;
    return next();
  });

exports.getReorderItems = (Model) =>
  asyncHandler(async (req, res) => {
    const documents = await Model.find()
      .select('_id title image status category order')
      .setOptions({ skipPopulate: true })
      .populate({ path: 'category', select: 'title' })
      .sort('order -createdAt');

    const data = documents.map((document) => ({
      _id: document._id,
      title: document.title,
      image: document.image,
      status: document.status,
      category: document.category,
      order: document.order || 0,
    }));

    res.status(200).json({
      results: data.length,
      data,
    });
  });

exports.updateItemsOrder = (Model) =>
  asyncHandler(async (req, res, next) => {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return next(new ApiError('items must be a non-empty array', 400));
    }

    const ids = new Set();
    const orders = new Set();

    for (const item of items) {
      if (!item || !mongoose.Types.ObjectId.isValid(item.id)) {
        return next(new ApiError('Each item must include a valid id', 400));
      }

      const order = Number(item.order);
      if (!Number.isInteger(order) || order < 1) {
        return next(
          new ApiError('Each item order must be a positive integer', 400),
        );
      }

      if (ids.has(item.id)) {
        return next(new ApiError('Duplicate item ids are not allowed', 400));
      }

      if (orders.has(order)) {
        return next(new ApiError('Duplicate order values are not allowed', 400));
      }

      ids.add(item.id);
      orders.add(order);
    }

    await Model.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { order: Number(item.order) } },
        },
      })),
    );

    res.status(200).json({
      status: 'success',
      message: 'Items reordered successfully',
    });
  });
