import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const toArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  return Array.isArray(value) ? value : [value];
};

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsIn(['package', 'course', 'home', 'profile'])
  sharedTo: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsMongoId({ each: true })
  course?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsMongoId({ each: true })
  package?: string[];
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(['package', 'course', 'home', 'profile'])
  sharedTo?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsMongoId({ each: true })
  course?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsMongoId({ each: true })
  package?: string[];
}

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  content?: string;
}

export class CreateReactionDto {
  @IsIn(['like', 'love', 'haha', 'sad', 'angry'])
  type: string;
}

export class CreateGroupChatDto {
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsMongoId({ each: true })
  participantIds?: string[];

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ParticipantDto {
  @IsEmail()
  userEmail: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}

export class CustomerServiceDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class AddUserToCourseChatsDto {
  @IsMongoId()
  userId: string;
}

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  text?: string;
}

export class MessageReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class CreateLiveDto {
  @IsNotEmpty()
  title: any;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsMongoId({ each: true })
  package?: string[];

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsIn(['pending', 'active', 'completed'])
  status?: string;

  @IsOptional()
  @IsMongoId()
  instructor?: string;
}

export class UpdateLiveDto {
  @IsOptional()
  title?: any;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsMongoId({ each: true })
  package?: string[];

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsIn(['pending', 'active', 'completed'])
  status?: string;
}

export class SendLiveEmailsDto {
  @IsOptional()
  @IsString()
  info?: string;
}

export class FcmTokenDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;

  @IsIn(['register', 'unregister'])
  method: string;
}

export class PushNotificationsDto {
  @IsBoolean()
  enabled: boolean;
}
