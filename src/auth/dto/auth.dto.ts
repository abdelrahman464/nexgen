import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { IsEmail, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

export class SignupDto {
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
  @IsNotEmpty()
  @Match('password', { message: 'Password confirmation incorrect' })
  passwordConfirm!: string;

  @IsString()
  @MinLength(2)
  country!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  invitationKey?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class VerifyResetCodeDto {
  @IsString()
  @IsNotEmpty()
  resetCode!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  newPassword!: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class ResendEmailCodeDto {
  @IsEmail()
  email!: string;
}

export class AdminIssueUserTokenDto {
  @IsMongoId()
  userId!: string;
}

export class GoogleMobileDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
