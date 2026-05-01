const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

const Course = require('../models/courseModel');
const Package = require('../models/packageModel');
const CoursePackage = require('../models/coursePackageModel');

const models = [
  { name: 'Course', Model: Course },
  { name: 'Package', Model: Package },
  { name: 'CoursePackage', Model: CoursePackage },
];

async function backfillModelOrder({ name, Model }) {
  const lastOrderedDocument = await Model.findOne({ order: { $gt: 0 } })
    .sort('-order')
    .select('order')
    .setOptions({ skipPopulate: true })
    .lean();

  const startOrder = lastOrderedDocument?.order || 0;
  const unorderedDocuments = await Model.find({
    $or: [
      { order: { $exists: false } },
      { order: null },
      { order: { $lte: 0 } },
    ],
  })
    .sort('-createdAt')
    .select('_id')
    .setOptions({ skipPopulate: true })
    .lean();

  if (unorderedDocuments.length === 0) {
    console.log(`${name}: no records need order backfill`);
    return;
  }

  await Model.bulkWrite(
    unorderedDocuments.map((document, index) => ({
      updateOne: {
        filter: { _id: document._id },
        update: { $set: { order: startOrder + index + 1 } },
      },
    })),
  );

  console.log(`${name}: backfilled ${unorderedDocuments.length} records`);
}

async function run() {
  if (!process.env.DB_URI) {
    throw new Error('Missing DB_URI in config.env');
  }

  await mongoose.connect(process.env.DB_URI);

  for (const model of models) {
    await backfillModelOrder(model);
  }

  await mongoose.disconnect();
}

run()
  .then(() => {
    console.log('Item order backfill completed');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Item order backfill failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  });
