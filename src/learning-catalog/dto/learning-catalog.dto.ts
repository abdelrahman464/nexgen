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

export class CreateSectionDto {
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title!: LocalizedStringDto;

  @IsMongoId()
  course!: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title?: LocalizedStringDto;

  @IsOptional()
  @IsMongoId()
  course?: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class CreateLessonDto {
  @IsMongoId()
  section!: string;

  @IsOptional()
  @IsMongoId()
  course?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title!: LocalizedStringDto;

  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  description!: LocalizedStringDto;

  @IsString()
  videoUrl!: string;

  @IsNumber()
  lessonDuration!: number;

  @IsOptional()
  @IsIn(['live', 'recorded'])
  type?: string;

  @IsOptional()
  @IsBoolean()
  isRequireAnalytic?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateLessonDto extends CreateLessonDto {
  @IsOptional()
  section!: string;

  @IsOptional()
  title!: LocalizedStringDto;

  @IsOptional()
  description!: LocalizedStringDto;

  @IsOptional()
  videoUrl!: string;

  @IsOptional()
  lessonDuration!: number;
}

export class CreateExamDto {
  @IsOptional()
  @IsObject()
  title?: Record<string, string>;

  @IsOptional()
  @IsMongoId()
  course?: string;

  @IsOptional()
  @IsMongoId()
  lesson?: string;

  @IsIn(['course', 'lesson', 'placement'])
  type!: string;

  @IsOptional()
  @IsIn(['A', 'B'])
  model?: string;

  @IsOptional()
  @IsNumber()
  passingScore?: number;

  @IsOptional()
  @IsArray()
  questions?: Record<string, unknown>[];
}

export class UpdateExamDto extends CreateExamDto {
  @IsOptional()
  type!: string;
}

export class SubmitAnswersDto {
  @IsArray()
  answers!: { question: string; answer: string | number }[];
}

export class CreateAnalyticDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsMongoId()
  course?: string;

  @IsOptional()
  @IsMongoId()
  lesson?: string;
}

export class UpdateAnalyticDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  isPassed?: boolean;

  @IsOptional()
  @IsBoolean()
  isSeen?: boolean;

  @IsOptional()
  @IsString()
  marketerComment?: string;
}
