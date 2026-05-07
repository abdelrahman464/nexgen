import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogReorderService } from './catalog-reorder.service';
import { CoursePackageSchema, CourseSchema, PackageSchema } from './catalog.schemas';
import { CoursePackagesController, PackagesController } from './learning-catalog.controller';
import { LearningCatalogService } from './learning-catalog.service';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: 'Package', schema: PackageSchema, collection: 'packages' },
      { name: 'CoursePackage', schema: CoursePackageSchema, collection: 'coursepackages' },
      { name: 'Course', schema: CourseSchema, collection: 'courses' },
    ]),
  ],
  controllers: [PackagesController, CoursePackagesController],
  providers: [LearningCatalogService, CatalogQueryService, CatalogReorderService],
  exports: [LearningCatalogService, CatalogQueryService, CatalogReorderService, MongooseModule],
})
export class LearningCatalogModule {}
