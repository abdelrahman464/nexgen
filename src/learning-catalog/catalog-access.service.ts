import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

@Injectable()
export class CatalogAccessService {
  constructor(
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('Lesson') private readonly lessonModel: Model<any>,
    @InjectModel('Section') private readonly sectionModel: Model<any>,
    @InjectModel('CourseProgress') private readonly courseProgressModel: Model<any>,
    @InjectModel('Exam') private readonly examModel: Model<any>,
  ) {}

  async assertAdminOrCourseInstructor(user: any, courseId: string) {
    if (user.role === 'admin') return;
    if (!user.isInstructor) throw new NotFoundException('You are not instructor');
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    if (course.instructor?._id?.toString() !== user._id.toString() && course.instructor?.toString() !== user._id.toString()) {
      throw new NotFoundException('You are not the instructor of this course');
    }
  }

  async assertSectionInstructor(user: any, sectionIdOrCourseId: string, byCourse = false) {
    if (user.role === 'admin') return;
    const courseId = byCourse ? sectionIdOrCourseId : (await this.sectionModel.findById(sectionIdOrCourseId))?.course;
    if (!courseId) throw new NotFoundException('Section not found');
    await this.assertAdminOrCourseInstructor(user, courseId.toString());
  }

  async assertLessonInstructor(user: any, lessonIdOrCourseId: string, byCourse = false) {
    if (user.role === 'admin') return;
    const courseId = byCourse ? lessonIdOrCourseId : (await this.lessonModel.findById(lessonIdOrCourseId))?.course;
    if (!courseId) throw new NotFoundException('Lesson not found');
    await this.assertAdminOrCourseInstructor(user, courseId.toString());
  }

  async assertCourseAccess(user: any, courseIdOrSlug: string) {
    if (user.role === 'admin') return;
    const course = Types.ObjectId.isValid(courseIdOrSlug)
      ? await this.courseModel.findById(courseIdOrSlug)
      : await this.courseModel.findOne({ slug: courseIdOrSlug });
    if (!course) throw new ForbiddenException('errors.Not-Found');
  }

  async assertLessonAccess(user: any, lessonId: string) {
    if (user.role === 'admin') return;
    const lesson = await this.lessonModel.findById(lessonId);
    if (!lesson) throw new ForbiddenException('Lesson Not Found');
    const courseProgress = await this.courseProgressModel.findOne({ user: user._id, course: lesson.course });
    if (!courseProgress) throw new ForbiddenException("You don't have access to this course");
  }

  async assertExamInstructor(user: any, examIdOrBody: string | Record<string, any>) {
    if (user.role === 'admin') return;
    let examData: any = examIdOrBody;
    if (typeof examIdOrBody === 'string') {
      examData = await this.examModel.findById(examIdOrBody);
      if (!examData) throw new NotFoundException('Exam not found');
    }
    if (examData.type === 'lesson') {
      const lesson = await this.lessonModel.findById(examData.lesson);
      if (!lesson) throw new NotFoundException('Associated course not found');
      await this.assertAdminOrCourseInstructor(user, lesson.course.toString());
      return;
    }
    await this.assertAdminOrCourseInstructor(user, examData.course?.toString());
  }

  async assertAnalyticOwnerOrAdmin(user: any, analytic: any) {
    if (user.role === 'admin') return;
    if (analytic.user?._id?.toString() === user._id.toString() || analytic.user?.toString() === user._id.toString()) return;
    throw new ForbiddenException('You are not authorized to access this analytic');
  }
}
