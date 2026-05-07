import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

export class ItemAnalyticsQueryDto {
  @IsOptional()
  @Matches(/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/)
  startDate?: string;

  @IsOptional()
  @Matches(/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/)
  endDate?: string;

  @IsOptional()
  @IsMongoId()
  marketerId?: string;
}

export class StartMarketingDto {
  @IsIn(['instructor', 'marketer', 'affiliate'])
  role: 'instructor' | 'marketer' | 'affiliate';

  @ValidateIf((body) => body.role === 'affiliate')
  @IsMongoId()
  fallBackCoach?: string;
}

export class ModifyInvitationKeysDto {
  @IsIn(['add', 'remove'])
  option: 'add' | 'remove';

  @IsString()
  @IsNotEmpty()
  invitationKey: string;
}

export class PaymentDetailsDto {
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsString()
  @IsNotEmpty()
  receiverAcc: string;
}

export class ProfitCalculationDto {
  @IsOptional()
  @IsIn(['manual', 'auto'])
  profitsCalculationMethod?: 'manual' | 'auto';

  @ValidateIf((body) => body.profitsCalculationMethod === 'manual')
  @Transform(({ value }) => Number(value))
  @IsNumber()
  profitPercentage?: number;

  @IsOptional()
  @IsIn(['manual', 'auto'])
  commissionsProfitsCalculationMethod?: 'manual' | 'auto';

  @ValidateIf((body) => body.commissionsProfitsCalculationMethod === 'manual')
  @Transform(({ value }) => Number(value))
  @IsNumber()
  commissionsProfitsPercentage?: number;
}

export class CreateInvoiceDto {
  @Transform(({ value }) => Number(value))
  @IsNumber()
  amount: number;
}

export class UpdateInvoiceStatusDto {
  @IsIn(['pending', 'paid', 'rejected'])
  status: 'pending' | 'paid' | 'rejected';
}

export class InvoiceQueryDto {
  @IsIn(['wallet', 'profit', 'instructorProfits'])
  invoiceType: 'wallet' | 'profit' | 'instructorProfits';
}

export class ModifyProfitableItemsDto {
  @IsArray()
  profitableItems: Array<{ itemId: string; itemType: string; percentage: number }>;
}

export class CreateMarketerRatingDto {
  @IsMongoId()
  marketer: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  ratings: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class EmailMarketingQueryDto {
  @IsOptional()
  query?: Record<string, any>;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  limit?: number;
}
