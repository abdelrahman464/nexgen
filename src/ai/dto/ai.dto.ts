import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsMongoId, IsNotEmpty, IsNumberString, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

const toArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value : [value];
};

export class AiChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class AiChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  messages!: AiChatMessageDto[];

  @IsOptional()
  @IsMongoId()
  chatId?: string;

  @IsOptional()
  @IsString()
  guestKey?: string;
}

export class CreateAiChatSessionDto {
  @IsOptional()
  @IsString()
  title?: string;
}

export class LocalizedTextDto {
  @IsOptional()
  @IsString()
  en?: string;

  @IsOptional()
  @IsString()
  ar?: string;
}

export class CreateAiKnowledgeDto {
  @IsObject()
  title!: Record<string, string>;

  @IsOptional()
  @IsIn(['faq', 'raw_doc'])
  type?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  questionExamples?: Record<string, string>[];

  @IsOptional()
  @IsObject()
  answer?: Record<string, string>;

  @IsOptional()
  @IsObject()
  content?: Record<string, string>;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['en', 'ar', 'both'])
  locale?: string;

  @IsOptional()
  @IsIn(['active', 'inActive', 'pending'])
  status?: string;
}

export class UpdateAiKnowledgeDto extends CreateAiKnowledgeDto {
  @IsOptional()
  title!: Record<string, string>;
}

export class SyncItemDto {
  @IsIn(['course', 'learningPath', 'service', 'knowledge'])
  sourceType!: string;

  @IsMongoId()
  sourceId!: string;
}

export class SyncSelectedDto {
  @IsOptional()
  @IsIn(['manual', 'auto'])
  mode?: string;

  @IsOptional()
  @IsIn(['course', 'learningPath', 'service', 'knowledge'])
  sourceType?: string;

  @IsOptional()
  @IsMongoId()
  sourceId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncItemDto)
  items?: SyncItemDto[];
}

export class SyncActionDto {
  @IsOptional()
  @IsIn(['manual', 'auto'])
  mode?: string;
}

export class AiKnowledgeQueryDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  ragStatus?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}

export class IdDocumentActionDto {
  @IsIn(['verified', 'rejected'])
  action!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
