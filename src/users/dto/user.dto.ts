import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsMongoId, IsOptional, IsString, MaxLength, MinLength, registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'Match',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return value === (args.object as Record<string, unknown>)[relatedPropertyName];
        },
      },
    });
  };
}

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password!: string;

  @IsString()
  @Match('password', { message: 'Password confirmation incorrect' })
  passwordConfirm!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsIn(['user', 'admin', 'campaign', 'moderator'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isInstructor?: boolean;

  @IsOptional()
  @IsBoolean()
  isCustomerService?: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  password?: string;

  @IsOptional()
  passwordConfirm?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsIn(['pending', 'verified', 'rejected'])
  idVerification?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password!: string;

  @IsString()
  @Match('password', { message: 'Password confirmation incorrect' })
  passwordConfirm!: string;
}

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class MongoIdDto {
  @IsMongoId()
  id!: string;
}
