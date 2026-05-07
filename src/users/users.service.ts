import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import mongoose, { Model } from 'mongoose';
import { ApiException } from '../common/exceptions/api.exception';
import { ApiQueryHelper } from '../common/pagination/api-query.helper';
import { ImageProcessingService } from '../common/upload/image-processing.service';

const Order = require('../../models/orderModel');
const Message = require('../../models/MessageModel');
const Chat = require('../../models/ChatModel');
const Notification = require('../../models/notificationModel');
const ReactModel = require('../../models/reactionModel');
const Comment = require('../../models/commentModel');
const CourseProgress = require('../../models/courseProgressModel');
const MarketLog = require('../../models/MarketingModel');

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly images: ImageProcessingService,
  ) {}

  async listUsers(query: Record<string, any>, filter: Record<string, any> = {}) {
    return this.listDocuments(this.userModel, query, 'User', filter);
  }

  listInstructors(query: Record<string, any>) {
    return this.listUsers(query, { isInstructor: true });
  }

  listAdminsAndInstructors(query: Record<string, any>) {
    return this.listUsers(query, { $or: [{ isInstructor: true }, { role: 'admin' }] });
  }

  async getUser(id: string, currentUser: any) {
    const query =
      currentUser.role === 'admin'
        ? this.userModel.findById(id)
        : this.userModel
            .findById(id)
            .select('name email profileImg authToReview bio coverImg role timeSpent isMarketer isInstructor isCustomerService startMarketing idNumber phone country idVerification note signatureImage');
    const user = await query;
    if (!user) throw new NotFoundException('No user found');
    return { data: user };
  }

  async createUser(body: any, files?: UserUploadFiles) {
    const payload = await this.withUploadedImages({ ...body }, files);
    delete payload.passwordConfirm;
    await this.assertEmailAvailable(payload.email);
    return { status: 'created successfully', data: await this.userModel.create(payload) };
  }

  async updateUser(id: string, body: any, files?: UserUploadFiles) {
    const payload = await this.withUploadedImages({ ...body }, files);
    delete payload.password;
    delete payload.passwordConfirm;
    if (payload.email) await this.assertEmailAvailable(payload.email, id);
    const user = await this.userModel.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!user) throw new NotFoundException(`No document For this id ${id}`);
    return { status: 'updated successfully', data: user };
  }

  async changeUserPassword(id: string, body: any) {
    const user = await this.userModel.findById(id).select('+password');
    if (!user) throw new NotFoundException(`No document For this id ${id}`);
    if (!(await bcrypt.compare(body.currentPassword, user.password))) {
      throw new ApiException('Incorrect current password', 401);
    }
    user.password = body.password;
    user.passwordChangedAt = Date.now();
    await user.save({ validateBeforeSave: false });
    return { data: user };
  }

  async deleteUser(id: string) {
    await mongoose.connection
      .transaction(async (session) => {
        const user = await this.userModel.findByIdAndDelete(id).session(session);
        if (!user) throw new NotFoundException(`User not found for this id ${id}`);
        await Promise.all([
          Order.deleteMany({ user: user._id }).session(session),
          Message.deleteMany({ sender: user._id }).session(session),
          Notification.deleteMany({ user: user._id }).session(session),
          ReactModel.deleteMany({ user: user._id }).session(session),
          Comment.deleteMany({ user: user._id }).session(session),
          CourseProgress.deleteMany({ user: user._id }).session(session),
          MarketLog.deleteOne({ marketer: user._id }).session(session),
          Chat.updateMany(
            { 'participants.user': user._id, isGroupChat: true },
            { $pull: { participants: { user: user._id } } },
          ).session(session),
          Chat.deleteMany({ 'participants.user': user._id, isGroupChat: false }).session(session),
        ]);
      })
      .catch((error: unknown) => {
        if (error instanceof NotFoundException) throw error;
        console.error('Transaction error:', error);
        throw new ApiException('Error during transaction', 500);
      });
    return undefined;
  }

  async updateLoggedUserPassword(user: any, body: any, generateToken: (id: string) => string) {
    const freshUser = await this.userModel.findById(user._id).select('+password');
    if (!freshUser) throw new NotFoundException('User not found');
    if (!(await bcrypt.compare(body.currentPassword, freshUser.password))) {
      throw new ApiException('Incorrect current password', 401);
    }
    freshUser.password = body.password;
    freshUser.passwordChangedAt = Date.now();
    await freshUser.save({ validateBeforeSave: false });
    return { data: freshUser, token: generateToken(String(user._id)) };
  }

  async updateLoggedUserData(user: any, body: any, files?: UserUploadFiles) {
    const currentUser = await this.userModel.findById(user._id);
    if (!currentUser) throw new NotFoundException('User not found');

    const payload = await this.withUploadedImages(
      {
        profileImg: body.profileImg,
        coverImg: body.coverImg,
        signatureImage: body.signatureImage,
        bio: body.bio,
        lang: body.lang,
      },
      files,
    );

    if (!currentUser.country && body.country) payload.country = body.country;
    if (!currentUser.phone && body.phone) payload.phone = body.phone;

    const updatedUser = await this.userModel.findByIdAndUpdate(user._id, payload, { new: true });
    return { data: updatedUser };
  }

  async setActive(id: string, active: boolean) {
    await this.userModel.findByIdAndUpdate(id, { active });
    if (active) return { data: 'success' };
    return undefined;
  }

  async findById(id: string) {
    return this.userModel.findById(id);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async assertEmailAvailable(email: string, excludeId?: string) {
    const existing = await this.userModel.findOne({ email });
    if (existing && existing._id.toString() !== excludeId) {
      throw new ApiException('E-mail already in use', 400);
    }
  }

  async withUploadedImages(body: Record<string, any>, files?: UserUploadFiles) {
    if (files?.profileImg?.[0]) {
      body.profileImg = await this.images.saveImageAsWebp(files.profileImg[0], 'users', 'profileImg', 95);
    }
    if (files?.coverImg?.[0]) {
      body.coverImg = await this.images.saveImageAsWebp(files.coverImg[0], 'users', 'coverImg', 95);
    }
    if (files?.signatureImage?.[0]) {
      body.signatureImage = await this.images.saveImageAsWebp(files.signatureImage[0], 'users', 'signatureImage', 95);
    }
    if (files?.idDocuments?.length) {
      body.idDocuments = await this.images.saveManyImagesAsWebp(files.idDocuments, 'users/idDocuments', 'idDocuments', 95);
    }
    return body;
  }

  private async listDocuments(model: Model<any>, query: Record<string, any>, modelName = '', filter: Record<string, any> = {}) {
    const computedFilter = Object.keys(filter).length ? filter : this.filterFromQuery(query);
    const totalCount = await model.countDocuments(computedFilter);
    const data = await new ApiQueryHelper(model.find(computedFilter), query, '-createdAt')
      .search(modelName)
      .sort()
      .limitFields()
      .paginate();
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
}

export type UserUploadFiles = {
  profileImg?: Express.Multer.File[];
  coverImg?: Express.Multer.File[];
  signatureImage?: Express.Multer.File[];
  idDocuments?: Express.Multer.File[];
};
