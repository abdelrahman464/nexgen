import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { CatalogAccessService } from './catalog-access.service';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogReorderService } from './catalog-reorder.service';
import { CoursePackageSchema, CourseProgressSchema, CourseSchema, LessonSchema, PackageSchema, SectionSchema } from './catalog.schemas';
import { CoursePackagesController, CoursesController, LessonsController, PackagesController, SectionsController } from './learning-catalog.controller';
import { LearningCatalogService } from './learning-catalog.service';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: 'Package', schema: PackageSchema, collection: 'packages' },
      { name: 'CoursePackage', schema: CoursePackageSchema, collection: 'coursepackages' },
      { name: 'Course', schema: CourseSchema, collection: 'courses' },
      { name: 'Section', schema: SectionSchema, collection: 'sections' },
      { name: 'Lesson', schema: LessonSchema, collection: 'lessons' },
      { name: 'CourseProgress', schema: CourseProgressSchema, collection: 'courseprogresses' },
    ]),
  ],
  controllers: [PackagesController, CoursePackagesController, CoursesController, SectionsController, LessonsController],
  providers: [LearningCatalogService, CatalogQueryService, CatalogReorderService, CatalogAccessService],
  exports: [LearningCatalogService, CatalogQueryService, CatalogReorderService, CatalogAccessService, MongooseModule],
})
export class LearningCatalogModule {}
