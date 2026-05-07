import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { LocalizedStringDto } from '../../common/dto/localized-string.dto';

export class CreateContactDto {
  @IsEmail()
  email!: string;
  @IsString()
  @MinLength(2)
  name!: string;
  @IsString()
  subject!: string;
  @IsString()
  message!: string;
}

export class CreateContactUsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-zA-Z\s]+$/)
  name!: string;
  @IsEmail()
  email!: string;
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  message!: string;
}

export class CreateSystemReviewDto {
  @IsOptional()
  @IsString()
  title?: string;
  @IsNumber()
  @Min(1)
  @Max(5)
  ratings!: number;
}

export class UpdateSystemReviewDto {
  @IsOptional()
  @IsString()
  title?: string;
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  ratings?: number;
}

export class ReplyDto {
  @IsString()
  @IsNotEmpty()
  reply!: string;
}

export class ReplayDto {
  @IsString()
  @IsNotEmpty()
  replay!: string;
}

export class CreateReviewDto {
  @IsOptional()
  @IsString()
  title?: string;
  @IsNumber()
  @Min(1)
  @Max(5)
  ratings!: number;
  @IsOptional()
  @IsMongoId()
  course?: string;
}

export class UpdateReviewDto {
  @IsOptional()
  @IsString()
  title?: string;
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  ratings?: number;
}

export class WishlistCourseDto {
  @IsMongoId()
  courseId!: string;
}

export class CreateCategoryDto {
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title!: LocalizedStringDto;
  @IsOptional()
  @IsString()
  image?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title?: LocalizedStringDto;
  @IsOptional()
  @IsString()
  image?: string;
}

export class CreateArticalDto {
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title!: LocalizedStringDto;
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  description!: LocalizedStringDto;
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  content!: LocalizedStringDto;
  @IsString()
  readTime!: string;
  @IsOptional()
  @IsString()
  imageCover?: string;
  @IsOptional()
  @IsArray()
  images?: string[];
}

export class UpdateArticalDto {
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
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  content?: LocalizedStringDto;
  @IsOptional()
  @IsString()
  readTime?: string;
  @IsOptional()
  @IsString()
  imageCover?: string;
  @IsOptional()
  @IsArray()
  images?: string[];
}

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  couponName!: string;
  @IsString()
  @MinLength(3)
  reason!: string;
  @IsNumber()
  @Min(0)
  @Max(100)
  discount!: number;
  @IsNumber()
  maxUsageTimes!: number;
  @IsOptional()
  @IsIn(['pending', 'active', 'rejected'])
  status?: string;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  couponName?: string;
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;
  @IsOptional()
  @IsNumber()
  maxUsageTimes?: number;
  @IsOptional()
  @IsIn(['pending', 'active', 'rejected'])
  status?: string;
}

export class CreateEventDto {
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title!: LocalizedStringDto;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  description?: LocalizedStringDto;
  @IsDateString()
  date!: string;
  @IsString()
  link!: string;
  @IsOptional()
  @IsString()
  image?: string;
}

export class UpdateEventDto {
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
  @IsDateString()
  date?: string;
  @IsOptional()
  @IsString()
  link?: string;
  @IsOptional()
  @IsString()
  image?: string;
}

export class SystemNotificationDto {
  @IsOptional()
  users?: string[] | string;
  @IsObject()
  message!: Record<string, string>;
}

export class PushOnlyNotificationDto {
  @IsString()
  title!: string;
  @IsString()
  body!: string;
  @IsOptional()
  @IsArray()
  userIds?: string[];
  @IsOptional()
  @IsBoolean()
  sendToAll?: boolean;
  @IsOptional()
  @IsString()
  topic?: string;
}
