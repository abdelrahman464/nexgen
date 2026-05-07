import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminOrInstructorGuard } from '../common/guards/admin-or-instructor.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { createMulterOptions } from '../common/upload/upload.helper';
import {
  CreateCourseDto,
  CreateCoursePackageDto,
  CreateLessonDto,
  CreatePackageDto,
  CreateSectionDto,
  ReorderItemsDto,
  UpdateCourseDto,
  UpdateCoursePackageDto,
  UpdateLessonDto,
  UpdatePackageDto,
  UpdateSectionDto,
} from './dto/learning-catalog.dto';
import { LearningCatalogService, LessonUploadFiles } from './learning-catalog.service';

@Controller('packages')
export class PackagesController {
  constructor(private readonly catalog: LearningCatalogService) {}

  @Get('getAll')
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  getAllForAdmin(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.catalog.getPackages(query, user, true);
  }

  @Get('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getReorderItems() {
    return this.catalog.getPackageReorderItems();
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reorder(@Body() body: ReorderItemsDto) {
    return this.catalog.updatePackageOrder(body.items);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  getAll(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.catalog.getPackages(query, user, false);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  create(@Body() body: CreatePackageDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.catalog.createPackage(body, user, file);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.catalog.getPackage(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdatePackageDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.catalog.updatePackage(id, body, user, file);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalog.deletePackage(id);
  }
}

@Controller('coursePackages')
export class CoursePackagesController {
  constructor(private readonly catalog: LearningCatalogService) {}

  @Get('getAll')
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  getAllForAdmin(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.catalog.getCoursePackages(query, user, true);
  }

  @Get('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getReorderItems() {
    return this.catalog.getCoursePackageReorderItems();
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reorder(@Body() body: ReorderItemsDto) {
    return this.catalog.updateCoursePackageOrder(body.items);
  }

  @Get()
  getAll(@Query() query: Record<string, any>) {
    return this.catalog.getCoursePackages(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  create(@Body() body: CreateCoursePackageDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.catalog.createCoursePackage(body, user, file);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.catalog.getCoursePackage(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateCoursePackageDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.catalog.updateCoursePackage(id, body, user, file);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalog.deleteCoursePackage(id);
  }
}

@Controller('courses')
export class CoursesController {
  constructor(private readonly catalog: LearningCatalogService) {}

  @Get('MyCourses')
  @UseGuards(JwtAuthGuard)
  getMyCourses(@CurrentUser() user: any) {
    return this.catalog.getMyCourses(user);
  }

  @Get('MyCourses/:id')
  @UseGuards(JwtAuthGuard)
  getUserCourses(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.catalog.getMyCourses(user, id);
  }

  @Get('courseDetails/:id')
  @UseGuards(JwtAuthGuard)
  getCourseDetails(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalog.getCourseDetails(id);
  }

  @Get('getAll')
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  getAllForAdmin(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.catalog.getCourses(query, user, true);
  }

  @Get('instructorCourses')
  getInstructorCourses(@Query() query: Record<string, any>) {
    return this.catalog.getInstructorCourses(undefined, query);
  }

  @Get('instructorCourses/:id')
  getInstructorCoursesById(@Param('id', ParseObjectIdPipe) id: string, @Query() query: Record<string, any>) {
    return this.catalog.getInstructorCourses(id, query);
  }

  @Get('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getReorderItems() {
    return this.catalog.getCourseReorderItems();
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reorder(@Body() body: ReorderItemsDto) {
    return this.catalog.updateCourseOrder(body.items);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminOrInstructorGuard)
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  create(@Body() body: CreateCourseDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.catalog.createCourse(body, user, file);
  }

  @Get()
  getAll(@Query() query: Record<string, any>) {
    return this.catalog.getCourses(query);
  }

  @Post('addUserToCourse/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  addUserToCourse(@Param('id', ParseObjectIdPipe) id: string, @Body('userId', ParseObjectIdPipe) userId: string) {
    return this.catalog.addUserToCourse(id, userId);
  }

  @Put('assignInstructorPercentage/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  assignInstructorPercentage(@Param('id', ParseObjectIdPipe) id: string, @Body() body: Record<string, any>) {
    return this.catalog.assignInstructorPercentage(id, body);
  }

  @Delete('removeInstructorPercentage/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  removeInstructorPercentage(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalog.removeInstructorPercentage(id);
  }

  @Put('giveCertificate/:courseId/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file', createMulterOptions()))
  giveCertificate(@Param('courseId', ParseObjectIdPipe) courseId: string, @Param('userId', ParseObjectIdPipe) userId: string, @UploadedFile() file?: Express.Multer.File) {
    return this.catalog.giveCertificate(courseId, userId, file);
  }

  @Get('getCertificate/:id')
  getCertificate(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalog.getCertificate(id);
  }

  @Get('getCertificateLink/:courseId')
  @UseGuards(JwtAuthGuard)
  getCertificateLink(@Param('courseId', ParseObjectIdPipe) courseId: string, @CurrentUser() user: any) {
    return this.catalog.getCertificateLink(courseId, user);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.catalog.getCourse(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateCourseDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.catalog.updateCourse(id, body, user, file);
  }
}

@Controller('sections')
export class SectionsController {
  constructor(private readonly catalog: LearningCatalogService) {}

  @Put('update-sections-and-lessons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateSectionsAndLessons(@Body() body: Record<string, any>) {
    return this.catalog.updateSectionsAndLessons(body);
  }

  @Get(':courseId/course')
  getByCourse(@Param('courseId', ParseObjectIdPipe) courseId: string, @Query() query: Record<string, any>) {
    return this.catalog.getSections(query, { course: courseId });
  }

  @Get()
  getAll(@Query() query: Record<string, any>) {
    return this.catalog.getSections(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: CreateSectionDto, @CurrentUser() user: any) {
    return this.catalog.createSection(body, user);
  }

  @Get(':id')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalog.getSection(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateSectionDto, @CurrentUser() user: any) {
    return this.catalog.updateSection(id, body, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.catalog.deleteSection(id, user);
  }
}

@Controller(['lessons', 'courses/:courseId/lessons'])
export class LessonsController {
  constructor(private readonly catalog: LearningCatalogService) {}

  @Get('courseLessons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getCourseLessons(@Param('id') id: string, @CurrentUser() user: any) {
    return this.catalog.getCourseLessons(id, user);
  }

  @Get('sectionLessons/:id/public')
  getSectionLessonsPublic(@Param('id', ParseObjectIdPipe) id: string) {
    return this.catalog.getSectionLessons(id, undefined, false);
  }

  @Get('sectionLessons/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getSectionLessons(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.catalog.getSectionLessons(id, user, true);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAll(@Query() query: Record<string, any>) {
    return this.catalog.getLessons(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }, { name: 'attachments', maxCount: 10 }, { name: 'assignmentFile', maxCount: 1 }], createMulterOptions()))
  create(@Body() body: CreateLessonDto, @CurrentUser() user: any, @UploadedFiles() files?: LessonUploadFiles, @Param('courseId') courseId?: string) {
    if (courseId && !body.course) body.course = courseId;
    return this.catalog.createLesson(body, user, files);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getOne(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.catalog.getLesson(id, user);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'image', maxCount: 1 }, { name: 'attachments', maxCount: 10 }, { name: 'assignmentFile', maxCount: 1 }], createMulterOptions()))
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateLessonDto, @CurrentUser() user: any, @UploadedFiles() files?: LessonUploadFiles) {
    return this.catalog.updateLesson(id, body, user, files);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.catalog.deleteLesson(id, user);
  }
}
