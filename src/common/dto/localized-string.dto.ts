import { IsOptional, IsString, MinLength } from 'class-validator';

export class LocalizedStringDto {
  @IsString()
  @MinLength(3)
  en!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  ar?: string;
}
