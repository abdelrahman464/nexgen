import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import {
  getRuntimeCourseModel,
  getRuntimeCoursePackageModel,
  getRuntimePackageModel,
} from '../src/common/utils/runtime-models.util';

dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

interface BackfillModel {
  name: string;
  Model: any;
}

export async function backfillModelOrder({ name, Model }: BackfillModel, dryRun = false) {
  const lastOrderedDocument = await Model.findOne({ order: { $gt: 0 } })
    .sort('-order')
    .select('order')
    .setOptions({ skipPopulate: true })
    .lean();

  const startOrder = lastOrderedDocument?.order || 0;
  const unorderedDocuments = await Model.find({
    $or: [{ order: { $exists: false } }, { order: null }, { order: { $lte: 0 } }],
  })
    .sort('-createdAt')
    .select('_id')
    .setOptions({ skipPopulate: true })
    .lean();

  if (unorderedDocuments.length === 0) {
    console.log(`${name}: no records need order backfill`);
    return { name, backfilledCount: 0 };
  }

  if (!dryRun) {
    await Model.bulkWrite(
      unorderedDocuments.map((document: any, index: number) => ({
        updateOne: {
          filter: { _id: document._id },
          update: { $set: { order: startOrder + index + 1 } },
        },
      })),
    );
  }

  console.log(`${name}: backfilled ${unorderedDocuments.length} records${dryRun ? ' (dry run)' : ''}`);
  return { name, backfilledCount: unorderedDocuments.length };
}

export const getBackfillModels = (): BackfillModel[] => [
  { name: 'Course', Model: getRuntimeCourseModel() },
  { name: 'Package', Model: getRuntimePackageModel() },
  { name: 'CoursePackage', Model: getRuntimeCoursePackageModel() },
];

export async function runBackfill(dryRun = false) {
  if (!process.env.DB_URI) {
    throw new Error('Missing DB_URI in config.env');
  }

  await mongoose.connect(process.env.DB_URI);

  try {
    for (const model of getBackfillModels()) {
      await backfillModelOrder(model, dryRun);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runBackfill(process.argv.includes('--dry-run'))
    .then(() => {
      console.log('Item order backfill completed');
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Item order backfill failed:', error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
