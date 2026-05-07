import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserSubscriptionDto {
  @IsMongoId()
  user: string;
}

export class PurchaseForUserDto {
  @IsMongoId()
  id: string;

  @IsIn(['course', 'package', 'coursePackage'])
  type: 'course' | 'package' | 'coursePackage';

  @IsMongoId()
  userId: string;

  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isPaid: boolean;
}

export class CheckoutCouponDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  couponName?: string;
}

export class OrderQueryDto {
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  day?: string;
}

export type OrderItemType = 'course' | 'package' | 'coursePackage';
export type PaymentProviderName = 'stripe' | 'plisio' | 'lahza' | 'manual';

export interface PaymentDetails {
  id: string;
  email: string;
  price: number;
  method: PaymentProviderName;
  couponName?: string | null;
}
