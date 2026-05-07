import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderItemType } from '../commerce/dto/commerce.dto';

type CouponScopeResult = {
  canApply: boolean;
  errorMessage?: string | null;
};

@Injectable()
export class CouponRulesService {
  constructor(@InjectModel('Coupon') private readonly couponModel: Model<any>) {}

  async validateCoupon(couponName: string, marketerId?: string) {
    const coupon = await this.couponModel.findOne({ couponName });
    if (!coupon) return 'coupon-errors.Not-Found';
    if (coupon.status === 'rejected') return 'coupon-errors.unActive';
    if (coupon.maxUsageTimes <= coupon.usedTimes) return 'coupon-errors.Expired';

    if (!coupon.isAdminCoupon) {
      const couponMarketerId = this.getCouponMarketerId(coupon);
      if (!this.isInstructorCoupon(coupon) && (!couponMarketerId || couponMarketerId.toString() !== marketerId?.toString())) {
        return 'coupon-errors.Un-Authorized';
      }
    }

    return coupon;
  }

  canCouponApplyToScope(coupon: any, scope: OrderItemType, itemId: string): CouponScopeResult {
    switch (scope) {
      case 'course':
        if (coupon.courses && coupon.courses.length > 0) {
          const canApply = coupon.courses.some((courseId: any) => courseId.toString() === itemId.toString());
          return {
            canApply,
            errorMessage: canApply ? null : 'This coupon cannot be used for this course',
          };
        }
        break;
      case 'coursePackage':
        if (coupon.coursePackages && coupon.coursePackages.length > 0) {
          const canApply = coupon.coursePackages.some((packageId: any) => packageId.toString() === itemId.toString());
          return {
            canApply,
            errorMessage: canApply ? null : 'This coupon cannot be used for this course package',
          };
        }
        break;
      case 'package':
        if (coupon.packages && coupon.packages.length > 0) {
          const canApply = coupon.packages.some((packageId: any) => packageId.toString() === itemId.toString());
          return {
            canApply,
            errorMessage: canApply ? null : 'This coupon cannot be used for this package',
          };
        }
        break;
      default:
        return { canApply: false, errorMessage: 'Invalid scope type' };
    }

    return {
      canApply: false,
      errorMessage: `This coupon cannot be used for ${scope}s`,
    };
  }

  async incrementCouponUsedTimes(couponName: string) {
    await this.couponModel.findOneAndUpdate({ couponName }, { $inc: { usedTimes: 1 } }, { new: true });
    return true;
  }

  private getCouponMarketerId(coupon: any) {
    return coupon.marketer?._id || coupon.marketer;
  }

  private isInstructorCoupon(coupon: any) {
    return coupon.marketer?.isInstructor === true;
  }
}
