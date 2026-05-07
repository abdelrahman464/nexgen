import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import slugify from 'slugify';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ImageProcessingService } from '../common/upload/image-processing.service';
import { CatalogAccessService } from './catalog-access.service';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogReorderService } from './catalog-reorder.service';

@Injectable()
export class LearningCatalogService {
  constructor(
    @InjectModel('Package') private readonly packageModel: Model<any>,
    @InjectModel('CoursePackage') private readonly coursePackageModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('Section') private readonly sectionModel: Model<any>,
    @InjectModel('Lesson') private readonly lessonModel: Model<any>,
    @InjectModel('CourseProgress') private readonly courseProgressModel: Model<any>,
    @InjectModel('Exam') private readonly examModel: Model<any>,
    @InjectModel('Analytics') private readonly analyticsModel: Model<any>,
    @InjectModel('UserSubscription') private readonly userSubscriptionModel: Model<any>,
    private readonly query: CatalogQueryService,
    private readonly reorder: CatalogReorderService,
    private readonly access: CatalogAccessService,
    private readonly images: ImageProcessingService,
  ) {}

  async getPackages(query: Record<string, any>, user?: any, adminList = false) {
    let filter: Record<string, any> = adminList || query.all || user?.role === 'admin' ? {} : { status: 'active' };
    if (adminList && user?.role !== 'admin') {
      const instructorCourses = await this.courseModel
        .find({ instructor: user._id })
        .select('_id')
        .setOptions({ skipPopulate: true })
        .lean();
      filter.course = { $in: instructorCourses.map((course: any) => course._id) };
    }
    filter = this.query.applyCatalogFilters(query, filter, Boolean(adminList || query.all || user?.role === 'admin' || user?.isInstructor));
    return this.query.list(this.packageModel, query, 'Package', filter);
  }

  async getPackage(id: string) {
    const document = await this.findByIdOrSlug(this.packageModel, id);
    return { data: document };
  }

  async createPackage(body: any, user: any, file?: Express.Multer.File) {
    const payload = await this.prepareCatalogPayload(this.packageModel, body, user, file, 'packages', 'package');
    return { data: await this.packageModel.create(payload) };
  }

  async updatePackage(id: string, body: any, user: any, file?: Express.Multer.File) {
    const payload = await this.prepareCatalogPayload(this.packageModel, body, user, file, 'packages', 'package', false);
    const document = await this.packageModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!document) throw new NotFoundException(`No document For this id ${id}`);
    return { data: document };
  }

  async deletePackage(id: string) {
    const document = await this.packageModel.findByIdAndDelete(id);
    if (!document) throw new NotFoundException(`No document for this id ${id}`);
    return undefined;
  }

  getPackageReorderItems() {
    return this.reorder.getReorderItems(this.packageModel);
  }

  updatePackageOrder(items: { id: string; order: number }[]) {
    return this.reorder.updateItemsOrder(this.packageModel, items);
  }

  async getCoursePackages(query: Record<string, any>, user?: any, adminList = false) {
    let filter: Record<string, any> = adminList ? {} : { status: 'active' };
    if (adminList && user?.role !== 'admin' && user?.isInstructor) {
      const courses = await this.courseModel.find({ instructor: user._id }).select('_id').setOptions({ skipPopulate: true });
      if (courses.length === 0) return { results: 0, data: [] };
      filter = {
        $or: [
          { instructor: user._id },
          { courses: { $in: courses.map((course: any) => course._id) } },
        ],
      };
    }
    filter = this.query.applyCatalogFilters(query, filter, Boolean(adminList && (user?.role === 'admin' || user?.isInstructor)));
    return this.query.list(this.coursePackageModel, query, 'CoursePackage', filter);
  }

  async getCoursePackage(id: string) {
    const document = await this.findByIdOrSlug(this.coursePackageModel, id);
    return { data: document };
  }

  async createCoursePackage(body: any, user: any, file?: Express.Multer.File) {
    const payload = await this.prepareCatalogPayload(this.coursePackageModel, body, user, file, 'coursePackages', 'coursePackage');
    return { data: await this.coursePackageModel.create(payload) };
  }

  async updateCoursePackage(id: string, body: any, user: any, file?: Express.Multer.File) {
    const payload = await this.prepareCatalogPayload(this.coursePackageModel, body, user, file, 'coursePackages', 'coursePackage', false);
    const document = await this.coursePackageModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!document) throw new NotFoundException(`No document For this id ${id}`);
    return { data: document };
  }

  async deleteCoursePackage(id: string) {
    const document = await this.coursePackageModel.findByIdAndDelete(id);
    if (!document) throw new NotFoundException(`No document for this id ${id}`);
    return undefined;
  }

  getCoursePackageReorderItems() {
    return this.reorder.getReorderItems(this.coursePackageModel);
  }

  updateCoursePackageOrder(items: { id: string; order: number }[]) {
    return this.reorder.updateItemsOrder(this.coursePackageModel, items);
  }

  async getCourses(query: Record<string, any>, user?: any, adminList = false) {
    let filter: Record<string, any> = adminList || query.all ? {} : { status: 'active' };
    if (adminList && user?.role !== 'admin' && user?.isInstructor) {
      filter = { instructor: user._id };
    }
    filter = this.query.applyCatalogFilters(query, filter, Boolean(adminList && (user?.role === 'admin' || user?.isInstructor)));
    return this.query.list(this.courseModel, query, 'Course', filter);
  }

  async getInstructorCourses(id: string | undefined, query: Record<string, any>) {
    const filter = id ? { instructor: id } : {};
    return this.query.list(this.courseModel, query, 'Course', this.query.applyCatalogFilters(query, filter, true));
  }

  async getCourse(id: string) {
    const document = await this.findByIdOrSlug(this.courseModel, id);
    return { data: document };
  }

  async createCourse(body: any, user: any, file?: Express.Multer.File) {
    const payload = await this.prepareCatalogPayload(this.courseModel, body, user, file, 'courses', 'course');
    if (!payload.instructor) payload.instructor = user._id;
    return { data: await this.courseModel.create(payload) };
  }

  async updateCourse(id: string, body: any, user: any, file?: Express.Multer.File) {
    await this.access.assertAdminOrCourseInstructor(user, id);
    const payload = await this.prepareCatalogPayload(this.courseModel, body, user, file, 'courses', 'course', false);
    const document = await this.courseModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!document) throw new NotFoundException(`No document For this id ${id}`);
    return { data: document };
  }

  getCourseReorderItems() {
    return this.reorder.getReorderItems(this.courseModel);
  }

  updateCourseOrder(items: { id: string; order: number }[]) {
    return this.reorder.updateItemsOrder(this.courseModel, items);
  }

  async getMyCourses(user: any, id?: string) {
    const userId = id || user._id;
    const coursesProgress = await this.courseProgressModel.find({ user: userId });
    const courses = coursesProgress.map((courseProgress: any) => courseProgress.course);
    const coursesDetails = await this.courseModel.find({ _id: { $in: courses } });
    const data = await Promise.all(
      coursesDetails.map(async (course: any) => {
        const courseProgress = coursesProgress.find((progress: any) => progress.course.toString() === course._id.toString());
        const totalLessons = await this.lessonModel.countDocuments({ course: course._id });
        const completedLessons = courseProgress?.progress?.filter((item: any) => item.status === 'Completed').length || 0;
        const lessonPercent = totalLessons ? (completedLessons / totalLessons) * 100 : 0;
        const finalExamPercent = courseProgress?.score > 0 ? 100 : 0;
        return {
          ...(course.toObject ? course.toObject() : course),
          totalProgress: Number((lessonPercent * 0.8 + finalExamPercent * 0.2).toFixed(2)),
          lastLesson: courseProgress?.progress?.filter((item: any) => item.lesson).at(-1)?.lesson || null,
        };
      }),
    );
    return { status: 'success', total: data.length, data };
  }

  async getCourseDetails(id: string) {
    const course = await this.courseModel.findById(id);
    if (!course) throw new NotFoundException('Course not found');
    const lessons = await this.lessonModel.find({ course: id }).sort('order');
    const sections = await this.sectionModel.find({ course: id }).sort('order');
    return { status: 'success', data: { course, sections, lessons } };
  }

  async addUserToCourse(courseId: string, userId: string) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const progress = await this.courseProgressModel.findOneAndUpdate(
      { user: userId, course: courseId },
      { $setOnInsert: { user: userId, course: courseId } },
      { new: true, upsert: true },
    );
    return { status: 'success', data: progress };
  }

  async assignInstructorPercentage(courseId: string, body: any) {
    const course = await this.courseModel.findByIdAndUpdate(courseId, { instructorPercentage: body.instructorPercentage }, { new: true });
    if (!course) throw new NotFoundException('Course not found');
    return { status: 'success', data: course };
  }

  async removeInstructorPercentage(courseId: string) {
    const course = await this.courseModel.findByIdAndUpdate(courseId, { $unset: { instructorPercentage: '' } }, { new: true });
    if (!course) throw new NotFoundException('Course not found');
    return { status: 'success', data: course };
  }

  async giveCertificate(courseId: string, userId: string, file?: Express.Multer.File) {
    const certificateFile = file ? await this.saveCertificateFile(file) : undefined;
    const update: Record<string, any> = {};
    if (certificateFile) update['certificate.file'] = certificateFile;
    if (certificateFile) update['certificate._id'] = new Types.ObjectId();
    const progress = await this.courseProgressModel.findOneAndUpdate(
      { user: userId, course: courseId },
      { $set: update },
      { new: true },
    );
    if (!progress) {
      throw new NotFoundException(`No course progress found for this user ${userId} and course ${courseId} or user does not deserve a certificate`);
    }
    return { msg: 'Certificate given successfully', data: progress };
  }

  async getCertificate(id: string) {
    const progress = await this.courseProgressModel.findOne({ 'certificate._id': id });
    if (!progress) throw new NotFoundException('No Certificate found');
    return {
      certificate: {
        file: progress.certificate.file,
        _id: progress.certificate._id,
      },
    };
  }

  async getCertificateLink(courseId: string, user: any) {
    const courseProgress = await this.courseProgressModel.findOne({
      user: user._id,
      course: courseId,
      'certificate.file': { $exists: true, $ne: null },
    });
    if (!courseProgress || !courseProgress.certificate.file) {
      return { status: 'success', message: 'No certificate found for this user and course', data: { hasCertificate: false } };
    }
    return {
      status: 'success',
      message: 'Certificate found',
      data: {
        hasCertificate: true,
        certificateLink: courseProgress.certificate.file,
        certificateId: courseProgress.certificate._id,
      },
    };
  }

  async getSections(query: Record<string, any>, filter: Record<string, any> = {}) {
    return this.query.list(this.sectionModel, query, 'Section', filter);
  }

  async getSection(id: string) {
    const section = await this.sectionModel.findById(id);
    if (!section) throw new NotFoundException(`No document found for: ${id}`);
    return { data: section };
  }

  async createSection(body: any, user: any) {
    await this.access.assertAdminOrCourseInstructor(user, body.course);
    return { status: 'created successfully', data: await this.sectionModel.create(body) };
  }

  async updateSection(id: string, body: any, user: any) {
    await this.access.assertSectionInstructor(user, id);
    const section = await this.sectionModel.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!section) throw new NotFoundException(`No document For this id ${id}`);
    return { status: 'updated successfully', data: section };
  }

  async deleteSection(id: string, user: any) {
    await this.access.assertSectionInstructor(user, id);
    const section = await this.sectionModel.findByIdAndDelete(id);
    if (!section) throw new NotFoundException(`No document for this id ${id}`);
    await this.lessonModel.deleteMany({ section: id });
    return undefined;
  }

  async updateSectionsAndLessons(body: any) {
    const sections = Array.isArray(body.sections) ? body.sections : [];
    const lessons = Array.isArray(body.lessons) ? body.lessons : [];
    await Promise.all([
      ...sections.map((item: any) => this.sectionModel.findByIdAndUpdate(item.id || item._id, { order: item.order })),
      ...lessons.map((item: any) => this.lessonModel.findByIdAndUpdate(item.id || item._id, { order: item.order, section: item.section })),
    ]);
    return { status: 'success', message: 'Sections and lessons updated successfully' };
  }

  async getLessons(query: Record<string, any>, filter: Record<string, any> = {}) {
    return this.query.list(this.lessonModel, query, 'Lesson', filter);
  }

  async getCourseLessons(id: string, user: any) {
    await this.access.assertCourseAccess(user, id);
    const course = Types.ObjectId.isValid(id) ? await this.courseModel.findById(id) : await this.courseModel.findOne({ slug: id });
    const data = await this.lessonModel.find({ course: course._id }).sort('order');
    return { results: data.length, data };
  }

  async getSectionLessons(id: string, user?: any, protect = true) {
    const section = await this.sectionModel.findById(id);
    if (!section) throw new NotFoundException('Section not found');
    if (protect && user) await this.access.assertCourseAccess(user, section.course.toString());
    const data = await this.lessonModel.find({ section: id }).sort('order');
    return { results: data.length, data };
  }

  async getLesson(id: string, user: any) {
    await this.access.assertLessonAccess(user, id);
    const lesson = await this.lessonModel.findById(id);
    if (!lesson) throw new NotFoundException('Lesson Not Found');
    return { data: lesson };
  }

  async createLesson(body: any, user: any, files?: LessonUploadFiles) {
    const payload = await this.prepareLessonPayload(body, files);
    if (!payload.course && payload.section) {
      const section = await this.sectionModel.findById(payload.section);
      if (!section) throw new NotFoundException('Section Not Found');
      payload.course = section.course;
    }
    await this.access.assertAdminOrCourseInstructor(user, payload.course);
    return { status: 'created successfully', data: await this.lessonModel.create(payload) };
  }

  async updateLesson(id: string, body: any, user: any, files?: LessonUploadFiles) {
    await this.access.assertLessonInstructor(user, id);
    const payload = await this.prepareLessonPayload(body, files);
    const lesson = await this.lessonModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!lesson) throw new NotFoundException(`No document For this id ${id}`);
    return { status: 'updated successfully', data: lesson };
  }

  async deleteLesson(id: string, user: any) {
    await this.access.assertLessonInstructor(user, id);
    const lesson = await this.lessonModel.findByIdAndDelete(id);
    if (!lesson) throw new NotFoundException(`No document for this id ${id}`);
    return undefined;
  }

  async createExam(body: any, user: any) {
    await this.access.assertExamInstructor(user, body);
    return { data: await this.examModel.create(body) };
  }

  async getExams(query: Record<string, any>, filter: Record<string, any>) {
    return this.query.list(this.examModel, query, 'Exam', filter);
  }

  async getExam(id: string, user: any) {
    await this.access.assertExamInstructor(user, id);
    const exam = await this.examModel.findById(id);
    if (!exam) throw new NotFoundException('No document found');
    return { data: exam };
  }

  async updateExam(id: string, body: any, user: any) {
    await this.access.assertExamInstructor(user, id);
    const exam = await this.examModel.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!exam) throw new NotFoundException(`No document For this id ${id}`);
    return { data: exam };
  }

  async deleteExam(id: string, user: any) {
    await this.access.assertExamInstructor(user, id);
    const exam = await this.examModel.findByIdAndDelete(id);
    if (!exam) throw new NotFoundException(`No document for this id ${id}`);
    return undefined;
  }

  async addQuestionToExam(examId: string, body: any, user: any, files?: ExamUploadFiles) {
    await this.access.assertExamInstructor(user, examId);
    const question = await this.prepareQuestionPayload(body, files);
    const exam = await this.examModel.findByIdAndUpdate(examId, { $push: { questions: question } }, { new: true });
    if (!exam) throw new NotFoundException('Exam not found');
    return { data: exam };
  }

  async updateQuestionInExam(examId: string, questionId: string, body: any, user: any, files?: ExamUploadFiles) {
    await this.access.assertExamInstructor(user, examId);
    const question = await this.prepareQuestionPayload(body, files);
    const exam = await this.examModel.findOneAndUpdate(
      { _id: examId, 'questions._id': questionId },
      { $set: Object.fromEntries(Object.entries(question).map(([key, value]) => [`questions.$.${key}`, value])) },
      { new: true },
    );
    if (!exam) throw new NotFoundException('Question not found');
    return { data: exam };
  }

  async removeQuestionFromExam(examId: string, questionId: string, user: any) {
    await this.access.assertExamInstructor(user, examId);
    const exam = await this.examModel.findByIdAndUpdate(examId, { $pull: { questions: { _id: questionId } } }, { new: true });
    if (!exam) throw new NotFoundException('Exam not found');
    return { data: exam };
  }

  async getStudentExam(type: 'lesson' | 'course' | 'placement', id: string, user: any) {
    if (type === 'lesson') await this.access.assertLessonAccess(user, id);
    if (type === 'course') await this.access.assertCourseAccess(user, id);
    const filter = type === 'lesson' ? { type, lesson: id } : { type, course: id };
    const exam = await this.examModel.findOne(filter);
    if (!exam) throw new NotFoundException('Exam not found');
    return { data: exam };
  }

  async submitExam(type: 'lesson' | 'course' | 'placement', id: string, user: any, answers: any[]) {
    const exam = await this.examModel.findOne(type === 'lesson' ? { type, lesson: id } : { type, course: id });
    if (!exam) throw new NotFoundException('Exam not found');
    const totalGrade = exam.questions.reduce((sum: number, question: any) => sum + (question.grade || 1), 0) || exam.questions.length || 1;
    let earned = 0;
    const wrongAnswers: any[] = [];
    for (const question of exam.questions) {
      const answer = answers.find((item) => item.question?.toString() === question._id.toString());
      if (answer && Number(answer.answer) === Number(question.correctOption)) {
        earned += question.grade || 1;
      } else {
        wrongAnswers.push({ question: question._id, answer: answer?.answer });
      }
    }
    const score = Math.round((earned / totalGrade) * 100);
    const status = score >= exam.passingScore ? 'Completed' : 'failed';
    const courseId = type === 'lesson' ? (await this.lessonModel.findById(id))?.course : id;
    if (courseId) {
      const update =
        type === 'lesson'
          ? {
              $setOnInsert: { user: user._id, course: courseId },
              $push: { progress: { lesson: id, status, examScore: score, wrongAnswers } },
            }
          : {
              $set: { score, status, wrongAnswers, attemptDate: new Date() },
              $setOnInsert: { user: user._id, course: courseId },
            };
      await this.courseProgressModel.findOneAndUpdate({ user: user._id, course: courseId }, update, { upsert: true, new: true });
    }
    return { status: 'success', data: { score, status, wrongAnswers } };
  }

  async userScores(courseId: string, userId: string) {
    const progress = await this.courseProgressModel.findOne({ course: courseId, user: userId });
    return { data: progress };
  }

  async getProgressPerformance(courseId: string, userId: string) {
    const progress = await this.courseProgressModel.findOne({ course: courseId, user: userId });
    return { data: progress };
  }

  async getLessonPerformance(lessonId: string, userId: string) {
    const progress = await this.courseProgressModel.findOne({ user: userId, 'progress.lesson': lessonId });
    return { data: progress };
  }

  async getAnalytics(query: Record<string, any>, user: any, userOnly = false) {
    let filter: Record<string, any> = {};
    if (userOnly || user.role !== 'admin') filter.user = user._id;
    return this.query.list(this.analyticsModel, query, 'Analytic', filter);
  }

  async createAnalytic(body: any, user: any, files?: AnalyticsUploadFiles) {
    await this.assertUserSubscription(user._id, body.course);
    const payload = await this.prepareAnalyticsPayload({ ...body, user: user._id, marketer: user.invitor }, files);
    return { data: await this.analyticsModel.create(payload) };
  }

  async getAnalytic(id: string, user: any) {
    const analytic = await this.analyticsModel.findById(id);
    if (!analytic) throw new NotFoundException('No document found');
    await this.access.assertAnalyticOwnerOrAdmin(user, analytic);
    return { data: analytic };
  }

  async updateAnalytic(id: string, body: any, user: any) {
    const analytic = await this.analyticsModel.findById(id);
    if (!analytic) throw new NotFoundException('No document found');
    await this.access.assertAnalyticOwnerOrAdmin(user, analytic);
    const updated = await this.analyticsModel.findByIdAndUpdate(id, body, { new: true });
    return { data: updated };
  }

  async deleteAnalytic(id: string, user: any) {
    const analytic = await this.analyticsModel.findById(id);
    if (!analytic) throw new NotFoundException('No document found');
    await this.access.assertAnalyticOwnerOrAdmin(user, analytic);
    await this.analyticsModel.findByIdAndDelete(id);
    return undefined;
  }

  async getAnalyticsPerformance(userId: string, user: any) {
    if (user.role !== 'admin' && user._id.toString() !== userId) throw new BadRequestException('Not authorized');
    const analytics = await this.analyticsModel.find({ user: userId });
    return { results: analytics.length, data: analytics };
  }

  private async prepareCatalogPayload(
    model: Model<any>,
    body: Record<string, any>,
    user: any,
    file: Express.Multer.File | undefined,
    folder: string,
    prefix: string,
    assignOrder = true,
  ) {
    let payload = { ...body };
    this.convertArrayFields(payload);
    if (!payload.instructor) payload.instructor = user._id;
    if (payload.title?.en) payload.slug = slugify(payload.title.en);
    if (file) payload.image = await this.images.saveImageAsWebp(file, folder, prefix, 95);
    if (assignOrder) payload = await this.reorder.assignNextOrder(model, payload);
    return payload;
  }

  private convertArrayFields(payload: Record<string, any>) {
    ['highlights', 'whatWillLearn', 'coursePrerequisites', 'whoThisCourseFor', 'courses'].forEach((field) => {
      if (payload[field] && !Array.isArray(payload[field])) payload[field] = [payload[field]];
    });
  }

  private async findByIdOrSlug(model: Model<any>, id: string) {
    const document = Types.ObjectId.isValid(id) ? await model.findById(id) : await model.findOne({ slug: id });
    if (!document) throw new NotFoundException(`No document found for: ${id}`);
    return document;
  }

  private async prepareLessonPayload(body: Record<string, any>, files?: LessonUploadFiles) {
    const payload = { ...body };
    if (files?.image?.[0]) payload.image = await this.images.saveImageAsWebp(files.image[0], 'lessons/images', 'lesson', 95);
    if (files?.assignmentFile?.[0]) {
      payload.assignmentFile = await this.images.saveImageAsWebp(files.assignmentFile[0], 'lessons/assignments', 'lesson-assignment', 95);
    }
    if (files?.attachments?.length) {
      payload.attachments = await Promise.all(files.attachments.map((file, index) => this.saveLessonAttachment(file, index)));
    }
    return payload;
  }

  private async saveLessonAttachment(file: Express.Multer.File, index: number) {
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      throw new BadRequestException(`File ${index + 1} is not an image or PDF file.`);
    }
    if (file.mimetype.startsWith('image/')) {
      return this.images.saveImageAsWebp(file, 'lessons/attachments', `lesson-attachment-${index + 1}`, 95);
    }
    const filename = `lesson-attachment-${uuidv4()}-${Date.now()}-${index + 1}.pdf`;
    const filePath = path.join('uploads', 'lessons', 'attachments', filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.buffer);
    return filename;
  }

  private async saveCertificateFile(file: Express.Multer.File) {
    if (file.mimetype !== 'application/pdf') throw new BadRequestException('Unsupported file type. Only PDFs are allowed for certificate.');
    const filename = `certificate-${uuidv4()}${path.extname(file.originalname || '.pdf') || '.pdf'}`;
    const filePath = path.join('uploads', 'certificate', filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.buffer);
    return filename;
  }

  private async prepareQuestionPayload(body: Record<string, any>, files?: ExamUploadFiles) {
    const payload = { ...body };
    if (files?.questionImage?.[0]) {
      payload.questionImage = await this.images.saveImageAsWebp(files.questionImage[0], 'questions', 'question', 95);
    }
    if (files?.options?.length) {
      payload.options = await Promise.all(files.options.map((file, index) => this.images.saveImageAsWebp(file, 'questions/options', `option-${index + 1}`, 95)));
    }
    return payload;
  }

  private async prepareAnalyticsPayload(body: Record<string, any>, files?: AnalyticsUploadFiles) {
    const payload = { ...body };
    if (files?.imageCover?.[0]) payload.imageCover = await this.images.saveImageAsWebp(files.imageCover[0], 'analytics', 'analytic-cover', 95);
    if (files?.media?.length) payload.media = await Promise.all(files.media.map((file, index) => this.saveAnalyticsMedia(file, index)));
    return payload;
  }

  private async saveAnalyticsMedia(file: Express.Multer.File, index: number) {
    if (file.mimetype.startsWith('image/')) {
      return this.images.saveImageAsWebp(file, 'analytics', `analytic-media-${index + 1}`, 95);
    }
    if (file.mimetype !== 'application/pdf') throw new BadRequestException(`media ${index + 1} is not an image or PDF file.`);
    const filename = `analytic-media-${uuidv4()}-${Date.now()}-${index + 1}.pdf`;
    const filePath = path.join('uploads', 'analytics', filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.buffer);
    return filename;
  }

  private async assertUserSubscription(userId: string, courseId?: string) {
    if (!courseId) return;
    const subscription = await this.userSubscriptionModel.findOne({ user: userId, course: courseId });
    if (!subscription) throw new BadRequestException('You do not have an active subscription');
  }
}

export type LessonUploadFiles = {
  image?: Express.Multer.File[];
  attachments?: Express.Multer.File[];
  assignmentFile?: Express.Multer.File[];
};

export type ExamUploadFiles = {
  questionImage?: Express.Multer.File[];
  options?: Express.Multer.File[];
};

export type AnalyticsUploadFiles = {
  imageCover?: Express.Multer.File[];
  media?: Express.Multer.File[];
};
