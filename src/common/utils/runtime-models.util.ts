import mongoose, { Schema } from 'mongoose';
import { CourseProgressSchema, LessonSchema, CoursePackageSchema, CourseSchema, PackageSchema } from '../../learning-catalog/catalog.schemas';
import { UserSchema } from '../../users/user.schema';

const ErrorLogSchema = new Schema(
  {
    name: String,
    message: String,
    stack: String,
    url: String,
    timestamp: { type: Date, default: Date.now },
  },
  { collection: 'errorlogs' },
);

const getModel = (name: string, schema: Schema, collection: string) =>
  mongoose.models[name] || mongoose.model(name, schema, collection);

export const getRuntimeUserModel = () => getModel('User', UserSchema, 'users');

export const getRuntimeCourseProgressModel = () =>
  getModel('CourseProgress', CourseProgressSchema, 'courseprogresses');

export const getRuntimeLessonModel = () => getModel('Lesson', LessonSchema, 'lessons');

export const getRuntimeCourseModel = () => getModel('Course', CourseSchema, 'courses');

export const getRuntimePackageModel = () => getModel('Package', PackageSchema, 'packages');

export const getRuntimeCoursePackageModel = () =>
  getModel('CoursePackage', CoursePackageSchema, 'coursepackages');

export const getRuntimeErrorLogModel = () => getModel('ErrorLog', ErrorLogSchema, 'errorlogs');

export async function logRuntimeErrorToDatabase(error: any, url?: string | null) {
  const ErrorLog = getRuntimeErrorLogModel();
  await ErrorLog.create({
    name: error?.name || 'Error',
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    url,
    timestamp: new Date(),
  });
}
