import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { LegacyAuthGuard } from '../common/guards/legacy-auth.guard';
import { OptionalLegacyAuthGuard } from '../common/guards/optional-legacy-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { createMulterOptions } from '../common/upload/upload.helper';
import {
  CreateArticalDto,
  CreateCategoryDto,
  CreateContactDto,
  CreateContactUsDto,
  CreateCouponDto,
  CreateEventDto,
  CreateReviewDto,
  CreateSystemReviewDto,
  PushOnlyNotificationDto,
  ReplyDto,
  ReplayDto,
  SystemNotificationDto,
  UpdateArticalDto,
  UpdateCategoryDto,
  UpdateCouponDto,
  UpdateEventDto,
  UpdateReviewDto,
  UpdateSystemReviewDto,
  WishlistCourseDto,
} from './dto/foundation-data.dto';
import { FoundationDataService } from './foundation-data.service';

@Controller('contactInfo')
export class ContactInfoController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Get()
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  getAll(@Query() query: Record<string, any>) {
    return this.foundation.getContacts(query);
  }

  @Post()
  create(@Body() body: CreateContactDto) {
    return this.foundation.createContact(body);
  }

  @Get(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.getContact(id);
  }

  @Delete(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.deleteContact(id);
  }
}

@Controller('contactUs')
export class ContactUsController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Post()
  create(@Body() body: CreateContactUsDto) {
    return this.foundation.createContactUs(body);
  }

  @Get()
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  getAll(@Query() query: Record<string, any>) {
    return this.foundation.getContactUs(query);
  }
}

@Controller('systemReviews')
export class SystemReviewsController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Get('myReviews')
  @UseGuards(LegacyAuthGuard)
  getMyReviews(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.foundation.getSystemReviews(query, { user: user._id });
  }

  @Get()
  getAll(@Query() query: Record<string, any>) {
    return this.foundation.getSystemReviews(query);
  }

  @Post()
  @UseGuards(LegacyAuthGuard)
  create(@Body() body: CreateSystemReviewDto, @CurrentUser() user: any) {
    return this.foundation.createSystemReview(body, user);
  }

  @Get(':id')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.getSystemReview(id);
  }

  @Put(':id')
  @UseGuards(LegacyAuthGuard)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateSystemReviewDto, @CurrentUser() user: any) {
    return this.foundation.updateSystemReview(id, body, user);
  }

  @Delete(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  delete(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.foundation.deleteSystemReview(id, user);
  }

  @Put(':id/replay')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  replay(@Param('id', ParseObjectIdPipe) id: string, @Body() body: ReplayDto) {
    return this.foundation.replaySystemReview(id, body.replay);
  }
}

@Controller(['reviews', 'courses/:courseId/reviews'])
export class ReviewsController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Get('myReview')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('user')
  getMyReview(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.foundation.getReviews(query, { user: user._id });
  }

  @Get()
  getAll(@Param('courseId') courseId: string | undefined, @Query() query: Record<string, any>) {
    return this.foundation.getReviews(query, courseId ? { course: courseId } : {});
  }

  @Post()
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  create(@Param('courseId') courseId: string | undefined, @Body() body: CreateReviewDto, @CurrentUser() user: any) {
    return this.foundation.createReview(body, user, courseId);
  }

  @Put(':id/reply')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  reply(@Param('id', ParseObjectIdPipe) id: string, @Body() body: ReplyDto) {
    return this.foundation.replyToReview(id, body.reply);
  }

  @Get(':id')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.getReview(id);
  }

  @Put(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('user')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateReviewDto, @CurrentUser() user: any) {
    return this.foundation.updateReview(id, body, user);
  }

  @Delete(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  delete(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.foundation.deleteReview(id, user);
  }
}

@Controller('wishlist')
@UseGuards(LegacyAuthGuard, RolesGuard)
@Roles('admin', 'user')
export class WishlistController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Get()
  getWishlist(@CurrentUser() user: any) {
    return this.foundation.getWishlist(user);
  }

  @Post()
  add(@Body() body: WishlistCourseDto, @CurrentUser() user: any) {
    return this.foundation.addWishlistCourse(body.courseId, user);
  }

  @Delete(':courseId')
  remove(@Param('courseId', ParseObjectIdPipe) courseId: string, @CurrentUser() user: any) {
    return this.foundation.removeWishlistCourse(courseId, user);
  }
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Get()
  getAll(@Query() query: Record<string, any>) {
    return this.foundation.getCategories(query);
  }

  @Post()
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  create(@Body() body: CreateCategoryDto, @UploadedFile() file?: Express.Multer.File) {
    return this.foundation.createCategory(body, file);
  }

  @Get(':id')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.getCategory(id);
  }

  @Put(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateCategoryDto, @UploadedFile() file?: Express.Multer.File) {
    return this.foundation.updateCategory(id, body, file);
  }
}

@Controller('articals')
export class ArticalsController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Post()
  @UseGuards(LegacyAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'imageCover', maxCount: 1 }, { name: 'images', maxCount: 20 }], createMulterOptions()))
  create(@Body() body: CreateArticalDto, @UploadedFiles() files: { imageCover?: Express.Multer.File[]; images?: Express.Multer.File[] }, @CurrentUser() user: any) {
    return this.foundation.createArtical(body, user, files);
  }

  @Get('getAll')
  @UseGuards(LegacyAuthGuard)
  getInstructorArticals(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.foundation.getArticals(query, user.role !== 'admin' ? { author: user._id } : {});
  }

  @Get()
  getActive(@Query() query: Record<string, any>) {
    return this.foundation.getArticals(query, { status: 'active' });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.foundation.getArtical(id);
  }

  @Put(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'imageCover', maxCount: 1 }, { name: 'images', maxCount: 20 }], createMulterOptions()))
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateArticalDto, @UploadedFiles() files?: { imageCover?: Express.Multer.File[]; images?: Express.Multer.File[] }) {
    return this.foundation.updateArtical(id, body, files);
  }

  @Delete(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.deleteArtical(id);
  }
}

@Controller('coupons')
export class CouponsController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Get('getCouponDetails/:couponName')
  @UseGuards(OptionalLegacyAuthGuard)
  getCouponDetails(@Param('couponName') couponName: string, @CurrentUser() user: any) {
    return this.foundation.getCouponDetails(couponName, user);
  }

  @Get()
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getAll(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.foundation.getCoupons(query, user);
  }

  @Post()
  @UseGuards(LegacyAuthGuard)
  create(@Body() body: CreateCouponDto, @CurrentUser() user: any) {
    return this.foundation.createCoupon(body, user);
  }

  @Get(':id')
  @UseGuards(LegacyAuthGuard)
  getOne(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.foundation.getCoupon(id, user);
  }

  @Put(':id')
  @UseGuards(LegacyAuthGuard)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateCouponDto, @CurrentUser() user: any) {
    return this.foundation.updateCoupon(id, body, user);
  }

  @Delete(':id')
  @UseGuards(LegacyAuthGuard)
  delete(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.foundation.deleteCoupon(id, user);
  }
}

@Controller('events')
export class EventsController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Get()
  getAll(@Query() query: Record<string, any>) {
    return this.foundation.getEvents(query);
  }

  @Post()
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  create(@Body() body: CreateEventDto, @UploadedFile() file?: Express.Multer.File) {
    return this.foundation.createEvent(body, file);
  }

  @Get(':id')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.getEvent(id);
  }

  @Put(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateEventDto) {
    return this.foundation.updateEvent(id, body);
  }

  @Delete(':id')
  @UseGuards(LegacyAuthGuard, RolesGuard)
  @Roles('admin')
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.deleteEvent(id);
  }
}

@Controller('notifications')
@UseGuards(LegacyAuthGuard)
export class NotificationsController {
  constructor(private readonly foundation: FoundationDataService) {}

  @Get('unreadCount')
  getUnreadCount(@CurrentUser() user: any) {
    return this.foundation.getUnreadNotificationCount(user);
  }

  @Post('systemNotificationToAll')
  @UseGuards(RolesGuard)
  @Roles('admin')
  systemToAll(@Body() body: SystemNotificationDto) {
    return this.foundation.sendSystemNotificationToAll(body);
  }

  @Post('pushOnly')
  @UseGuards(RolesGuard)
  @Roles('admin')
  pushOnly(@Body() body: PushOnlyNotificationDto) {
    return this.foundation.sendPushOnly(body);
  }

  @Get()
  getMine(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.foundation.getMyNotifications(query, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  sendToUsers(@Body() body: SystemNotificationDto) {
    return this.foundation.sendSystemNotificationToUsers(body);
  }

  @Put()
  readAll(@CurrentUser() user: any) {
    return this.foundation.readAllNotifications(user);
  }

  @Put(':id')
  readOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.readNotification(id);
  }

  @Delete(':id')
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.foundation.deleteNotification(id);
  }
}
