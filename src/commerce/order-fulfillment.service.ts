import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderItemType, PaymentDetails } from './dto/commerce.dto';

const User = require('../../models/userModel');
const Chat = require('../../models/ChatModel');
const Notification = require('../../models/notificationModel');
const { PDFGenerator } = require('../../utils/generatePdf');
const { sendEmail } = require('../../utils/sendEmail');
const { incrementCouponUsedTimes } = require('../../services/couponService');

const availUserToReview = async (userId: string) => {
  const userService = require('../../services/userService');
  return userService.availUserToReview(userId);
};

const handleOrderCommissions = async (item: any, saleDetails: any) => {
  const marketingHelper = require('../../helpers/marketingHelper');
  return marketingHelper.handleOrderCommissions(item, saleDetails);
};

const htmlEmail = ({ order }: { order: any }) => {
  const packageTitle = (order.package && order.package.title) || { en: 'Package', ar: 'Package' };
  const userName = (order.user && order.user.name) || 'Customer';

  return `
    <!DOCTYPE html>
    <html>
    <body>
      <p>Hello ${userName},</p>
      <p>Your subscription to ${packageTitle.en || packageTitle.ar || 'Package'} has been successfully created.</p>
    </body>
    </html>
  `;
};

@Injectable()
export class OrderFulfillmentService {
  constructor(
    @InjectModel('Order') private readonly orderModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('Package') private readonly packageModel: Model<any>,
    @InjectModel('CoursePackage') private readonly coursePackageModel: Model<any>,
    @InjectModel('CourseProgress') private readonly courseProgressModel: Model<any>,
    @InjectModel('UserSubscription') private readonly userSubscriptionModel: Model<any>,
  ) {}

  async fulfillPaidOrder(type: OrderItemType, details: PaymentDetails) {
    if (type === 'course') return this.fulfillPaidCourse(details);
    if (type === 'package') return this.fulfillPaidPackage(details);
    return this.fulfillPaidCoursePackage(details);
  }

  async purchaseForUser(type: OrderItemType, id: string, userId: string, isPaid: boolean) {
    if (type === 'course') await this.createManualCourseOrder(id, userId, isPaid);
    else if (type === 'package') await this.createManualPackageOrder(id, userId, isPaid);
    else await this.createManualCoursePackageOrder(id, userId, isPaid);
    return { status: 'success', message: 'Order created successfully' };
  }

  async createUnPaidCourseOrder(courseId: string, user: any) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    if (course.price && course.price > 0) throw new BadRequestException('Course is not free');
    await this.createManualCourseOrder(courseId, user._id, false);
    return { status: 'success', message: 'Order created successfully' };
  }

  async createOrUpdateSubscription(userId: string, packageId: string, durationDays: number) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + durationDays);

    const packageDoc = await this.packageModel.findById(packageId).populate('course');
    const subscription = await this.userSubscriptionModel.findOne({ user: userId, package: packageId }).sort({ endDate: -1 });

    if (subscription) {
      subscription.endDate = endDate;
      await subscription.save();
    } else {
      await this.userSubscriptionModel.create({ user: userId, package: packageId, startDate, endDate });
    }
    if (packageDoc?.course?._id) await this.addUserToGroupChatAndNotify(userId, packageDoc.course._id);
  }

  async addSubscriberToPackage(packageId: string, userId: string) {
    const packageDoc = await this.packageModel.findById(packageId);
    if (!packageDoc) throw new NotFoundException('Collection Not Found');
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + packageDoc.subscriptionDurationDays);
    const subscription = await this.userSubscriptionModel.create({ user: userId, package: packageId, startDate, endDate });
    return { subscription };
  }

  private async createPaidOrder(orderDetails: {
    userId: string;
    marketer: string;
    itemId: string;
    price: number;
    method: string;
    itemType: OrderItemType;
    couponName?: string | null;
  }) {
    const order = await this.orderModel.findOne({
      user: orderDetails.userId,
      [orderDetails.itemType]: orderDetails.itemId,
      paymentMethodType: orderDetails.method,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    const isResale = await this.orderModel.exists({ user: orderDetails.userId, isPaid: true });
    if (order) return null;
    return this.orderModel.create({
      user: orderDetails.userId,
      marketer: orderDetails.marketer,
      [orderDetails.itemType]: orderDetails.itemId,
      totalOrderPrice: orderDetails.price,
      isPaid: true,
      paymentMethodType: orderDetails.method,
      paidAt: Date.now(),
      isResale: Boolean(isResale),
      coupon: orderDetails.couponName,
    });
  }

  private async createCourseProgress(userId: string, courseId: string) {
    const existingProgress = await this.courseProgressModel.findOne({ user: userId, course: courseId });
    if (!existingProgress) await this.courseProgressModel.create({ user: userId, course: courseId, progress: [] });
  }

  private async addUserToGroupChatAndNotify(userId: string, courseId: string) {
    const chat = await Chat.findOneAndUpdate(
      { course: courseId, isGroupChat: true },
      { $addToSet: { participants: { user: userId, isAdmin: false } } },
      { new: true },
    );
    if (!chat) return;
    await Notification.create({
      user: userId,
      message: {
        en: `You have been added to the group ${chat.groupName}`,
        ar: `تمت اضافتك الى المجموعة ${chat.groupName}`,
      },
      chat: chat._id,
      type: 'chat',
    });
  }

  private async fulfillPaidCourse(details: PaymentDetails) {
    const [course, user, packageDoc] = await Promise.all([
      this.courseModel.findById(details.id),
      User.findOne({ email: details.email }),
      this.packageModel.findOne({ course: details.id }),
    ]);
    if (!course || !user) throw new Error('Course or user not found');
    let order = await this.createPaidOrder({
      userId: user._id,
      marketer: user.invitor,
      itemId: course._id,
      price: Number(details.price),
      method: details.method,
      itemType: 'course',
      couponName: details.couponName,
    });
    if (!order) return null;
    order = await order.populate([
      { path: 'user', select: '_id name phone email' },
      { path: 'course', select: 'title -category' },
      { path: 'coursePackage', select: 'title' },
      { path: 'package', select: 'title' },
    ]);
    if (details.couponName) await incrementCouponUsedTimes(details.couponName);
    await this.createCourseProgress(user._id, course._id);
    await this.addUserToGroupChatAndNotify(user._id, course._id);
    if (packageDoc && course.freePackageSubscriptionInDays && course.freePackageSubscriptionInDays > 0) {
      await this.createOrUpdateSubscription(user._id, packageDoc._id, course.freePackageSubscriptionInDays);
    }
    await availUserToReview(user._id);
    await handleOrderCommissions(course, {
      email: user.email,
      invitor: user.invitor,
      amount: Number(details.price),
      date: order.createdAt,
      itemType: 'course',
      item: course.title,
      order: order._id,
      instructorId: course.instructorPercentage > 0 ? course.instructor : null,
    });
    await this.createOrderNotification(user, course, order, 'course');
    return order;
  }

  private async fulfillPaidPackage(details: PaymentDetails) {
    const [packageDoc, user] = await Promise.all([this.packageModel.findById(details.id), User.findOne({ email: details.email })]);
    if (!packageDoc || !user) throw new Error('Package or user not found');
    let order = await this.createPaidOrder({
      userId: user._id,
      marketer: user.invitor,
      itemId: packageDoc._id,
      price: Number(details.price),
      method: details.method,
      itemType: 'package',
      couponName: details.couponName,
    });
    if (!order) return null;
    order = await order.populate([
      { path: 'user', select: '_id name phone email' },
      { path: 'course', select: 'title -category' },
      { path: 'coursePackage', select: 'title' },
      { path: 'package', select: 'title' },
    ]);
    if (details.couponName) await incrementCouponUsedTimes(details.couponName);
    await this.createOrUpdateSubscription(user._id, packageDoc._id, packageDoc.subscriptionDurationDays);
    await handleOrderCommissions(packageDoc, {
      email: user.email,
      invitor: user.invitor,
      amount: Number(details.price),
      itemType: 'package',
      order: order._id,
      item: packageDoc.title,
    });
    await this.createOrderNotification(user, packageDoc, order, 'service');
    await sendEmail({ to: user.email, subject: 'Order Confirmation', html: htmlEmail({ order }) });
    return order;
  }

  private async fulfillPaidCoursePackage(details: PaymentDetails) {
    const [coursePackage, user] = await Promise.all([this.coursePackageModel.findById(details.id), User.findOne({ email: details.email })]);
    if (!coursePackage || !user) throw new Error('CoursePackage or user not found');
    let order = await this.createPaidOrder({
      userId: user._id,
      marketer: user.invitor,
      itemId: coursePackage._id,
      price: Number(details.price),
      method: details.method,
      itemType: 'coursePackage',
      couponName: details.couponName,
    });
    if (!order) return null;
    order = await order.populate([
      { path: 'user', select: '_id name phone email' },
      { path: 'course', select: 'title -category' },
      { path: 'coursePackage', select: 'title' },
      { path: 'package', select: 'title' },
    ]);
    if (details.couponName) await incrementCouponUsedTimes(details.couponName);
    await Promise.all(
      coursePackage.courses.map(async (courseId: string) => {
        await this.createCourseProgress(user._id, courseId);
        await this.addUserToGroupChatAndNotify(user._id, courseId);
        const packageDoc = await this.packageModel.findOne({ course: courseId });
        if (packageDoc) await this.createOrUpdateSubscription(user._id, packageDoc._id, 5 * 30);
      }),
    );
    await availUserToReview(user._id);
    await handleOrderCommissions(coursePackage, {
      email: user.email,
      invitor: user.invitor,
      amount: Number(details.price),
      itemType: 'coursePackage',
      order: order._id,
      item: coursePackage.title,
    });
    await this.createOrderNotification(user, coursePackage, order, 'Package');
    return order;
  }

  private async createOrderNotification(user: any, item: any, order: any, label: 'course' | 'service' | 'Package') {
    let pdfPath = await PDFGenerator.generateOrderPDF(order);
    pdfPath = pdfPath.replace('uploads/orders/', '');
    await Notification.create({
      user: user._id,
      message: {
        en: `You have successfully purchased the ${label} ${item.title?.en} click here to download the invoice`,
        ar: `لقد قمت بشراء ${item.title?.ar} بنجاح اضغط هنا لتحميل الفاتورة`,
      },
      file: pdfPath,
      type: 'order',
    });
  }

  private async createManualCourseOrder(id: string, userId: string, isPaid: boolean) {
    const [course, user, packageDoc] = await Promise.all([this.courseModel.findById(id), User.findById(userId), this.packageModel.findOne({ course: id })]);
    if (!course) throw new Error('Course not found');
    if (!user) throw new Error('User not found');
    const coursePrice = course.priceAfterDiscount || course.price || 0;
    const isResale = isPaid ? Boolean(await this.orderModel.exists({ user: userId, isPaid: true })) : undefined;
    const order = await this.orderModel.create({
      user: user._id,
      marketer: user.invitor,
      course: course._id,
      totalOrderPrice: isPaid ? coursePrice : 0,
      isPaid,
      isResale,
      paymentMethodType: isPaid ? 'manual' : null,
      paidAt: isPaid ? new Date() : null,
    });
    await this.createCourseProgress(user._id, course._id);
    await this.addUserToGroupChatAndNotify(user._id, course._id);
    if (packageDoc && course.freePackageSubscriptionInDays && course.freePackageSubscriptionInDays > 0) {
      await this.createOrUpdateSubscription(user._id, packageDoc._id, course.freePackageSubscriptionInDays);
    } else if (!isPaid && packageDoc && (!packageDoc.price || packageDoc.price <= 0)) {
      await this.createOrUpdateSubscription(user._id, packageDoc._id, packageDoc.subscriptionDurationDays || 4 * 30);
    }
    await availUserToReview(user._id);
    if (isPaid) {
      await handleOrderCommissions(course, {
        email: user.email,
        invitor: user.invitor,
        amount: coursePrice,
        itemType: 'course',
        item: course.title,
        order: order._id,
        instructorId: course.instructorPercentage > 0 ? course.instructor : null,
      });
    }
  }

  private async createManualPackageOrder(id: string, userId: string, isPaid: boolean) {
    const [packageDoc, user] = await Promise.all([this.packageModel.findById(id), User.findById(userId)]);
    if (!packageDoc) throw new Error('Package not found');
    if (!user) throw new Error('User not found');
    const packagePrice = packageDoc.priceAfterDiscount || packageDoc.price || 0;
    const isResale = isPaid ? Boolean(await this.orderModel.exists({ user: userId, isPaid: true })) : undefined;
    const order = await this.orderModel.create({
      user: user._id,
      marketer: user.invitor,
      package: packageDoc._id,
      totalOrderPrice: packagePrice,
      isPaid,
      isResale,
      paymentMethodType: isPaid ? 'manual' : null,
      paidAt: isPaid ? new Date() : null,
    });
    await this.createOrUpdateSubscription(user._id, packageDoc._id, packageDoc.subscriptionDurationDays);
    if (isPaid) {
      await handleOrderCommissions(packageDoc, {
        email: user.email,
        invitor: user.invitor,
        amount: packagePrice,
        itemType: 'package',
        order: order._id,
        item: packageDoc.title,
      });
    }
  }

  private async createManualCoursePackageOrder(id: string, userId: string, isPaid: boolean) {
    const [coursePackage, user] = await Promise.all([this.coursePackageModel.findById(id), User.findById(userId)]);
    if (!coursePackage) throw new Error('CoursePackage not found');
    if (!user) throw new Error('User not found');
    const coursePackagePrice = coursePackage.priceAfterDiscount || coursePackage.price || 0;
    const isResale = isPaid ? Boolean(await this.orderModel.exists({ user: userId, isPaid: true })) : undefined;
    const order = await this.orderModel.create({
      user: user._id,
      marketer: user.invitor,
      coursePackage: coursePackage._id,
      totalOrderPrice: coursePackagePrice,
      isPaid,
      isResale,
      paymentMethodType: isPaid ? 'manual' : null,
      paidAt: isPaid ? new Date() : null,
    });
    await Promise.all(
      coursePackage.courses.map(async (courseId: string) => {
        await this.createCourseProgress(user._id, courseId);
        await this.addUserToGroupChatAndNotify(user._id, courseId);
        const packageDoc = await this.packageModel.findOne({ course: courseId });
        if (packageDoc) await this.createOrUpdateSubscription(user._id, packageDoc._id, packageDoc.subscriptionDurationDays);
      }),
    );
    await availUserToReview(user._id);
    if (isPaid) {
      await handleOrderCommissions(coursePackage, {
        email: user.email,
        invitor: user.invitor,
        amount: coursePackagePrice,
        itemType: 'package',
        order: order._id,
        item: coursePackage.title,
      });
    }
  }
}
