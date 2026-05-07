import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { CourseProgressSchema, CourseSchema } from '../learning-catalog/catalog.schemas';
import { UserSchema } from '../users/user.schema';
import {
  ArticalSchema,
  CategorySchema,
  ContactSchema,
  ContactUsSchema,
  CouponSchema,
  EventSchema,
  NotificationSchema,
  ReviewSchema,
  SystemReviewSchema,
} from './foundation-data.schemas';
import {
  ArticalsController,
  CategoriesController,
  ContactInfoController,
  ContactUsController,
  CouponsController,
  EventsController,
  NotificationsController,
  ReviewsController,
  SystemReviewsController,
  WishlistController,
} from './foundation-data.controller';
import { FoundationDataService } from './foundation-data.service';
import { CouponRulesService } from './coupon-rules.service';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: 'Contact', schema: ContactSchema, collection: 'contacts' },
      { name: 'ContactUs', schema: ContactUsSchema, collection: 'contactus' },
      { name: 'SystemReview', schema: SystemReviewSchema, collection: 'systemreviews' },
      { name: 'Review', schema: ReviewSchema, collection: 'reviews' },
      { name: 'Category', schema: CategorySchema, collection: 'categories' },
      { name: 'Artical', schema: ArticalSchema, collection: 'articals' },
      { name: 'Coupon', schema: CouponSchema, collection: 'coupons' },
      { name: 'Event', schema: EventSchema, collection: 'events' },
      { name: 'Notification', schema: NotificationSchema, collection: 'notifications' },
      { name: 'Course', schema: CourseSchema, collection: 'courses' },
      { name: 'CourseProgress', schema: CourseProgressSchema, collection: 'courseprogresses' },
      { name: 'User', schema: UserSchema, collection: 'users' },
    ]),
  ],
  controllers: [
    ContactInfoController,
    ContactUsController,
    SystemReviewsController,
    ReviewsController,
    WishlistController,
    CategoriesController,
    ArticalsController,
    CouponsController,
    EventsController,
    NotificationsController,
  ],
  providers: [FoundationDataService, CouponRulesService],
  exports: [FoundationDataService, CouponRulesService, MongooseModule],
})
export class FoundationDataModule {}
