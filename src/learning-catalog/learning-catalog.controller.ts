import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminOrInstructorGuard } from '../common/guards/admin-or-instructor.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { createMulterOptions } from '../common/upload/upload.helper';
import { CreateCoursePackageDto, CreatePackageDto, ReorderItemsDto, UpdateCoursePackageDto, UpdatePackageDto } from './dto/learning-catalog.dto';
import { LearningCatalogService } from './learning-catalog.service';

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
