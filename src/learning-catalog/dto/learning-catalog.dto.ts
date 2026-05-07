import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { LocalizedStringDto } from '../../common/dto/localized-string.dto';

class ReorderItemDto {
  @IsMongoId()
  id!: string;

  @IsNumber()
  @Min(1)
  order!: number;
}

export class ReorderItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

class CatalogBaseDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title?: LocalizedStringDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  description?: LocalizedStringDto;

  @IsOptional()
  @IsMongoId()
  category?: string;

  @IsOptional()
  @IsMongoId()
  instructor?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  priceAfterDiscount?: number;

  @IsOptional()
  @IsIn(['active', 'pending', 'inActive'])
  status?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsArray()
  highlights?: Record<string, string>[];

  @IsOptional()
  @IsArray()
  whatWillLearn?: Record<string, string>[];

  @IsOptional()
  @IsArray()
  coursePrerequisites?: Record<string, string>[];

  @IsOptional()
  @IsArray()
  whoThisCourseFor?: Record<string, string>[];
}

export class CreatePackageDto extends CatalogBaseDto {
  @IsOptional()
  @IsMongoId()
  course?: string;

  @IsOptional()
  @IsNumber()
  subscriptionDurationDays?: number;

  @IsOptional()
  @IsIn(['service', 'course'])
  type?: string;
}

export class UpdatePackageDto extends CreatePackageDto {}

export class CreateCoursePackageDto extends CatalogBaseDto {
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  courses?: string[];

  @IsOptional()
  @IsArray()
  profitableCourses?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  type?: string;
}

export class UpdateCoursePackageDto extends CreateCoursePackageDto {}

export class CreateCourseDto extends CatalogBaseDto {
  @IsOptional()
  @IsBoolean()
  needAccessibleCourse?: boolean;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  accessibleCourses?: string[];
}

export class UpdateCourseDto extends CreateCourseDto {}
