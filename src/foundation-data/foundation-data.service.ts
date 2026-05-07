import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import slugify from 'slugify';
import { ApiQueryHelper } from '../common/pagination/api-query.helper';
import { ImageProcessingService } from '../common/upload/image-processing.service';

const { sendPushNotificationToTopic, sendPushNotificationToMultiple } = require('../../utils/pushNotification');

@Injectable()
export class FoundationDataService {
  constructor(
    @InjectModel('Contact') private readonly contactModel: Model<any>,
    @InjectModel('ContactUs') private readonly contactUsModel: Model<any>,
    @InjectModel('SystemReview') private readonly systemReviewModel: Model<any>,
    @InjectModel('Review') private readonly reviewModel: Model<any>,
    @InjectModel('Category') private readonly categoryModel: Model<any>,
    @InjectModel('Artical') private readonly articalModel: Model<any>,
    @InjectModel('Coupon') private readonly couponModel: Model<any>,
    @InjectModel('Event') private readonly eventModel: Model<any>,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('CourseProgress') private readonly courseProgressModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly images: ImageProcessingService,
  ) {}

  list(model: Model<any>, query: Record<string, any>, modelName = '', filter: Record<string, any> = {}) {
    return this.listDocuments(model, query, modelName, filter);
  }

  async createContact(body: any) {
    return { status: 'created successfully', data: await this.contactModel.create(body) };
  }

  getContacts(query: Record<string, any>) {
    return this.listDocuments(this.contactModel, query, 'Contact');
  }

  getContact(id: string) {
    return this.findOne(this.contactModel, id);
  }

  deleteContact(id: string) {
    return this.deleteDocument(this.contactModel, id);
  }

  async createContactUs(body: any) {
    return { status: 'created successfully', data: await this.contactUsModel.create(body) };
  }

  getContactUs(query: Record<string, any>) {
    return this.listDocuments(this.contactUsModel, query, 'ContactUs');
  }

  getSystemReviews(query: Record<string, any>, filter: Record<string, any> = {}) {
    return this.listDocuments(this.systemReviewModel, query, 'SystemReview', filter);
  }

  getSystemReview(id: string) {
    return this.findOne(this.systemReviewModel, id);
  }

  async createSystemReview(body: any, user: any) {
    const userProgress = await this.courseProgressModel.findOne({ user: user._id });
    if (!userProgress) throw new ForbiddenException('You are not allowed to review');
    const existing = await this.systemReviewModel.findOne({ user: user._id });
    if (existing) throw new ForbiddenException('you already have a review');
    return { status: 'created successfully', data: await this.systemReviewModel.create({ ...body, user: user._id }) };
  }

  async updateSystemReview(id: string, body: any, user: any) {
    const review = await this.systemReviewModel.findById(id);
    if (!review) throw new NotFoundException(`There is no review with id ${id}`);
    if (review.user._id.toString() !== user._id.toString()) throw new ForbiddenException('Your are not allowed to perform this action');
    return { status: 'updated successfully', data: await this.systemReviewModel.findByIdAndUpdate(id, body, { new: true }) };
  }

  async deleteSystemReview(id: string, user: any) {
    await this.assertOwnerOrAdmin(this.systemReviewModel, id, user);
    return this.deleteDocument(this.systemReviewModel, id);
  }

  async replaySystemReview(id: string, replay: string) {
    const review = await this.systemReviewModel.findByIdAndUpdate(id, { replay }, { new: true });
    if (!review) throw new NotFoundException(`No document For this id ${id}`);
    return { data: review };
  }

  getReviews(query: Record<string, any>, filter: Record<string, any> = {}) {
    return this.listDocuments(this.reviewModel, query, 'Review', filter);
  }

  getReview(id: string) {
    return this.findOne(this.reviewModel, id);
  }

  async createReview(body: any, user: any, courseId?: string) {
    const course = body.course || courseId;
    if (!course) throw new NotFoundException('course required');
    const courseDoc = await this.courseModel.findById(course);
    if (!courseDoc) throw new NotFoundException(`There are no course for this id ${course}`);
    if (user.role !== 'admin') {
      const progress = await this.courseProgressModel.findOne({ user: user._id, course });
      if (!progress) throw new ForbiddenException('You are not allowed to review this course');
    }
    const existing = await this.reviewModel.findOne({ user: user._id, course });
    if (existing) throw new ForbiddenException('you already have a review');
    return { status: 'created successfully', data: await this.reviewModel.create({ ...body, user: user._id, course }) };
  }

  async updateReview(id: string, body: any, user: any) {
    await this.assertOwner(this.reviewModel, id, user);
    const review = await this.reviewModel.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    return { data: review };
  }

  async deleteReview(id: string, user: any) {
    await this.assertOwnerOrAdmin(this.reviewModel, id, user);
    return this.deleteDocument(this.reviewModel, id);
  }

  async replyToReview(id: string, reply: string) {
    const review = await this.reviewModel.findByIdAndUpdate(id, { reply }, { new: true });
    if (!review) throw new NotFoundException(`No document For this id ${id}`);
    return { msg: 'updated', data: review };
  }

  async addWishlistCourse(courseId: string, user: any) {
    await this.assertCourseExists(courseId);
    const updatedUser = await this.userModel.findByIdAndUpdate(user._id, { $addToSet: { wishlist: courseId } }, { new: true });
    if (!updatedUser) throw new NotFoundException('no user found');
    return { status: 'success', message: 'course added successfully to your wishlist', data: updatedUser.wishlist };
  }

  async removeWishlistCourse(courseId: string, user: any) {
    await this.assertCourseExists(courseId);
    const updatedUser = await this.userModel.findByIdAndUpdate(user._id, { $pull: { wishlist: courseId } }, { new: true });
    return { status: 'success', message: 'course removed successfully from your wishlist', data: updatedUser.wishlist };
  }

  async getWishlist(user: any) {
    const currentUser = await this.userModel.findById(user._id).populate({ path: 'wishlist' });
    return { status: 'success', result: currentUser.wishlist.length, data: currentUser.wishlist };
  }

  async getCategories(query: Record<string, any>, locale?: string) {
    const response = await this.listDocuments(this.categoryModel, query, 'Category');
    const data = await Promise.all(response.data.map(async (category: any) => ({
      ...(category.toObject ? category.toObject() : category),
      courseCount: await this.courseModel.countDocuments({ category: category._id, status: 'active' }),
    })));
    return { ...response, data };
  }

  getCategory(id: string) {
    return this.findOne(this.categoryModel, id);
  }

  async createCategory(body: any, file?: Express.Multer.File) {
    if (file) body.image = await this.images.saveImageAsWebp(file, 'categories', 'categoryImage', 97);
    return { status: 'created successfully', data: await this.categoryModel.create(body) };
  }

  async updateCategory(id: string, body: any, file?: Express.Multer.File) {
    if (file) body.image = await this.images.saveImageAsWebp(file, 'categories', 'categoryImage', 97);
    return { status: 'updated successfully', data: await this.categoryModel.findByIdAndUpdate(id, body, { new: true }) };
  }

  async createArtical(body: any, user: any, files?: { imageCover?: Express.Multer.File[]; images?: Express.Multer.File[] }) {
    const payload = { ...body, author: user._id, slug: slugify(body.title?.en || body.title), status: user.role === 'admin' ? 'active' : 'pending' };
    if (files?.imageCover?.[0]) payload.imageCover = await this.images.saveImageAsWebp(files.imageCover[0], 'blog/artical', 'artical-cover');
    if (files?.images?.length) payload.images = await this.images.saveManyImagesAsWebp(files.images, 'blog/artical', 'artical');
    return { status: 'created successfully', data: await this.articalModel.create(payload) };
  }

  getArticals(query: Record<string, any>, filter: Record<string, any> = {}) {
    return this.listDocuments(this.articalModel, query, 'Artical', filter);
  }

  getArtical(id: string) {
    return this.findOne(this.articalModel, id);
  }

  async updateArtical(id: string, body: any, files?: { imageCover?: Express.Multer.File[]; images?: Express.Multer.File[] }) {
    const payload = { ...body };
    if (body.title?.en) payload.slug = slugify(body.title.en);
    if (files?.imageCover?.[0]) payload.imageCover = await this.images.saveImageAsWebp(files.imageCover[0], 'blog/artical', 'artical-cover');
    if (files?.images?.length) payload.images = await this.images.saveManyImagesAsWebp(files.images, 'blog/artical', 'artical');
    return { status: 'updated successfully', data: await this.articalModel.findByIdAndUpdate(id, payload, { new: true }) };
  }

  deleteArtical(id: string) {
    return this.deleteDocument(this.articalModel, id);
  }

  async getCouponDetails(couponName: string, user?: any) {
    const coupon = await this.couponModel.findOne({ couponName }).select('-__v -updatedAt').populate('courses', 'title').populate('coursePackages', 'title').populate('packages', 'title');
    if (!coupon) throw new NotFoundException('coupon-errors.Not-Found');
    if (coupon.status !== 'active') throw new NotFoundException('coupon-errors.unActive');
    if (coupon.maxUsageTimes <= coupon.usedTimes) throw new NotFoundException('coupon-errors.Expired');
    if (!coupon.isAdminCoupon && !coupon.marketer?.isInstructor) {
      const couponMarketerId = coupon.marketer?._id || coupon.marketer;
      const userId = user?._id?.toString();
      const userInvitorId = user?.invitor?.toString();
      if (!couponMarketerId || (couponMarketerId.toString() !== userId && couponMarketerId.toString() !== userInvitorId)) {
        throw new NotFoundException('coupon-errors.Un-Authorized');
      }
    }
    return { status: 'success', coupon };
  }

  getCoupons(query: Record<string, any>, user: any) {
    const filter = user.role === 'user' ? { marketer: user.id } : {};
    return this.listDocuments(this.couponModel, query, 'Coupon', filter);
  }

  async createCoupon(body: any, user: any) {
    this.assertCanPerformCouponAction(user);
    const existing = await this.couponModel.findOne({ couponName: body.couponName });
    if (existing && existing.status !== 'active') throw new ForbiddenException(`This coupon already exist with ${existing.status} status`);
    const payload = user.role === 'admin' ? { ...body, isAdminCoupon: true, marketer: null } : { ...body, isAdminCoupon: false, marketer: user.id };
    return { status: 'created successfully', data: await this.couponModel.create(payload) };
  }

  async updateCoupon(id: string, body: any, user: any) {
    this.assertCanPerformCouponAction(user);
    return { status: 'updated successfully', data: await this.couponModel.findByIdAndUpdate(id, body, { new: true }) };
  }

  async getCoupon(id: string, user: any) {
    this.assertCanPerformCouponAction(user);
    return this.findOne(this.couponModel, id);
  }

  async deleteCoupon(id: string, user: any) {
    this.assertCanPerformCouponAction(user);
    return this.deleteDocument(this.couponModel, id);
  }

  getEvents(query: Record<string, any>) {
    return this.listDocuments(this.eventModel, query, 'Event');
  }

  getEvent(id: string) {
    return this.findOne(this.eventModel, id);
  }

  async createEvent(body: any, file?: Express.Multer.File) {
    if (file) body.image = await this.images.saveImageAsWebp(file, 'events', 'eventImage', 97);
    return { status: 'created successfully', data: await this.eventModel.create(body) };
  }

  async updateEvent(id: string, body: any) {
    return { status: 'updated successfully', data: await this.eventModel.findByIdAndUpdate(id, body, { new: true }) };
  }

  deleteEvent(id: string) {
    return this.deleteDocument(this.eventModel, id);
  }

  getMyNotifications(query: Record<string, any>, user: any) {
    return this.listDocuments(this.notificationModel, query, 'Notification', { user: user._id });
  }

  async sendSystemNotificationToUsers(body: any) {
    const users = Array.isArray(body.users) ? body.users : [body.users];
    await Promise.all(users.map((user: string) => this.notificationModel.create({ user, message: body.message, type: 'system' })));
    return { status: 'success', message: 'Notifications sent successfully' };
  }

  async readAllNotifications(user: any) {
    await this.notificationModel.updateMany({ user: user._id }, { read: true });
    return { status: 'success', message: 'All notification read' };
  }

  async readNotification(id: string) {
    const notification = await this.notificationModel.findByIdAndUpdate(id, { read: true }, { new: true, runValidators: true });
    if (!notification) throw new NotFoundException('Notification not found');
    return { status: 'success', message: 'notification read' };
  }

  deleteNotification(id: string) {
    return this.deleteDocument(this.notificationModel, id);
  }

  async getUnreadNotificationCount(user: any) {
    return { count: await this.notificationModel.countDocuments({ user: user._id, read: false }) };
  }

  async sendSystemNotificationToAll(body: any) {
    const users = await this.userModel.find({ role: 'user' });
    await Promise.all(users.map((user: any) => this.notificationModel.create({ user: user._id, message: body.message, type: 'system' })));
    return { status: 'success', message: 'Notifications sent successfully' };
  }

  async sendPushOnly(body: any) {
    const notification = { title: body.title, body: body.body };
    let result;
    if (body.topic) {
      result = await sendPushNotificationToTopic(body.topic, notification);
    } else if (body.sendToAll) {
      const users = await this.userModel.find({ role: 'user', pushNotificationsEnabled: { $ne: false }, fcmTokens: { $exists: true, $ne: [] } }).select('fcmTokens');
      const tokens = users.flatMap((user: any) => user.fcmTokens);
      if (!tokens.length) throw new ForbiddenException('No FCM tokens found for users');
      result = await sendPushNotificationToMultiple(tokens, notification);
    } else if (body.userIds?.length) {
      const users = await this.userModel.find({ _id: { $in: body.userIds }, pushNotificationsEnabled: { $ne: false }, fcmTokens: { $exists: true, $ne: [] } }).select('fcmTokens');
      const tokens = users.flatMap((user: any) => user.fcmTokens);
      if (!tokens.length) throw new ForbiddenException('No FCM tokens found for specified users');
      result = await sendPushNotificationToMultiple(tokens, notification);
    } else {
      throw new ForbiddenException('Please specify userIds, sendToAll, or topic');
    }
    return { status: result.success ? 'success' : 'failed', message: result.success ? 'Push notification sent' : 'Failed to send push notification', data: result };
  }

  private async listDocuments(model: Model<any>, query: Record<string, any>, modelName = '', filter: Record<string, any> = {}) {
    const computedFilter = Object.keys(filter).length ? filter : this.filterFromQuery(query);
    const totalCount = await model.countDocuments(computedFilter);
    const orderedModelNames = ['Course', 'Package', 'CoursePackage'];
    const defaultSort = orderedModelNames.includes(modelName) ? 'order -createdAt' : '-createdAt';
    const data = await new ApiQueryHelper(model.find(computedFilter), query, defaultSort).search(modelName).sort().limitFields().paginate();
    const currentPage = Number.parseInt(query.page, 10) || 1;
    const limit = Number.parseInt(query.limit, 10) || 50;
    const numberOfPages = Math.ceil(totalCount / limit);
    return {
      results: data.length,
      paginationResult: {
        totalCount,
        currentPage,
        limit,
        numberOfPages,
        nextPage: currentPage < numberOfPages ? currentPage + 1 : null,
      },
      data,
    };
  }

  private filterFromQuery(query: Record<string, any>) {
    const filter = { ...query };
    ['page', 'sort', 'limit', 'fields', 'keyword'].forEach((key) => delete filter[key]);
    return filter;
  }

  private async findOne(model: Model<any>, id: string) {
    const document = Types.ObjectId.isValid(id) ? await model.findById(id) : await model.findOne({ slug: id });
    if (!document) throw new NotFoundException(`No document found for: ${id}`);
    return { data: document };
  }

  private async deleteDocument(model: Model<any>, id: string) {
    const document = await model.findById(id);
    if (!document) throw new NotFoundException(`No document for this id ${id}`);
    await document.remove();
    return undefined;
  }

  private async assertOwner(model: Model<any>, id: string, user: any) {
    const document = await model.findById(id);
    if (!document) throw new NotFoundException(`There is no review with id ${id}`);
    if (document.user._id.toString() !== user._id.toString()) throw new ForbiddenException('Your are not allowed to perform this action');
    return document;
  }

  private async assertOwnerOrAdmin(model: Model<any>, id: string, user: any) {
    const document = await model.findById(id);
    if (!document) throw new NotFoundException(`There is no review with id ${id}`);
    if (user.role !== 'admin' && document.user._id.toString() !== user._id.toString()) {
      throw new ForbiddenException('Your are not allowed to perform this action');
    }
    return document;
  }

  private async assertCourseExists(courseId: string) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException(`No course for this id : ${courseId}`);
  }

  private assertCanPerformCouponAction(user: any) {
    if (user.role !== 'admin' && !user.isMarketer && !user.isInstructor) {
      throw new ForbiddenException('You are not allowed to perform this action');
    }
  }
}
