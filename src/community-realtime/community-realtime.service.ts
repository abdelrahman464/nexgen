import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ApiQueryHelper } from '../common/pagination/api-query.helper';
import { ImageProcessingService } from '../common/upload/image-processing.service';

const { filterOffensiveWords } = require('../../utils/filterOffensiveWords');
const sendEmail = require('../../utils/sendEmail');

const toObjectId = (id: string | Types.ObjectId) => new Types.ObjectId(String(id));
const idString = (value: any) => String(value?._id || value);

@Injectable()
export class CommunityRealtimeService {
  constructor(
    @InjectModel('Post') private readonly postModel: Model<any>,
    @InjectModel('Comment') private readonly commentModel: Model<any>,
    @InjectModel('Reaction') private readonly reactionModel: Model<any>,
    @InjectModel('Chat') private readonly chatModel: Model<any>,
    @InjectModel('Message') private readonly messageModel: Model<any>,
    @InjectModel('Live') private readonly liveModel: Model<any>,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Course') private readonly courseModel: Model<any>,
    @InjectModel('Package') private readonly packageModel: Model<any>,
    @InjectModel('UserSubscription') private readonly userSubscriptionModel: Model<any>,
    @InjectModel('CourseProgress') private readonly courseProgressModel: Model<any>,
    private readonly images: ImageProcessingService,
  ) {}

  async getTopProfilePosters() {
    const topUsers = await this.postModel.aggregate([
      { $match: { sharedTo: 'profile' } },
      { $group: { _id: '$user', postsCount: { $sum: 1 } } },
      { $sort: { postsCount: -1, _id: 1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { _id: 1, name: 1, profileImg: 1 } }],
        },
      },
      { $unwind: '$user' },
      { $project: { _id: 0, user: '$user', postsCount: 1 } },
    ]);
    const baseURL = process.env.BASE_URL;
    const data = topUsers.map((item: any) => ({
      postsCount: item.postsCount,
      user: {
        _id: item.user._id,
        name: item.user.name,
        profileImg: item.user.profileImg ? `${baseURL}/users/${item.user.profileImg}` : null,
      },
    }));
    return { results: data.length, data };
  }

  async getPosts(query: Record<string, any>, user: any, filter: Record<string, any> = {}) {
    const page = Number.parseInt(query.page, 10) || 1;
    const limit = Number.parseInt(query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    const sort = query.sort ? JSON.parse(query.sort) : { createdAt: -1 };
    const loggedUserObjectId = user?._id ? toObjectId(user._id) : null;
    const [posts, totalDocuments] = await Promise.all([
      this.postModel.aggregate(this.postListPipeline(filter, loggedUserObjectId, sort, skip, limit) as any),
      this.postModel.countDocuments(filter),
    ]);
    const data = posts.map((post: any) => this.mapPostAggregation(post, true));
    return {
      results: data.length,
      paginationResult: {
        currentPage: page,
        limit,
        numberOfPages: Math.ceil(totalDocuments / limit),
      },
      data,
    };
  }

  async getHomePosts(query: Record<string, any>, user: any) {
    let filter: Record<string, any> = { sharedTo: 'home' };
    if (query.type === 'feed' || query.type === 'profile') {
      filter = { sharedTo: 'profile' };
      if (query.user) filter.user = toObjectId(query.user);
    } else if (query.type === 'following') {
      const currentUser = await this.userModel.findById(user._id).select('following');
      const usersIds = (currentUser?.following || []).map((item: any) => toObjectId(item.user));
      filter = { sharedTo: 'profile', user: { $in: usersIds } };
    }
    return this.getPosts(query, user, filter);
  }

  async getCoursePosts(course: string, query: Record<string, any>, user: any) {
    await this.assertCoursePostAccess(course, user);
    return this.getPosts(query, user, { sharedTo: 'course', course: { $in: [toObjectId(course)] } });
  }

  async getPackagePosts(packageId: string, query: Record<string, any>, user: any) {
    await this.assertPackagePostAccess(packageId, user);
    return this.getPosts(query, user, { sharedTo: 'package', package: { $in: [toObjectId(packageId)] } });
  }

  async createPost(body: any, user: any, files?: PostUploadFiles) {
    await this.assertPostAuthority(body, user);
    const payload = await this.withPostFiles({ ...body, user: user._id }, files);
    let notificationUsers: any[] = [];
    if (payload.sharedTo === 'package') notificationUsers = await this.fetchUsersFromTarget('package', payload.package);
    if (payload.sharedTo === 'course') notificationUsers = await this.fetchUsersFromTarget('course', payload.course);
    if (payload.sharedTo === 'profile') notificationUsers = await this.getUserFollowers(user._id);
    const post = await this.postModel.create({
      ...payload,
      package: payload.sharedTo === 'package' ? payload.package || [] : [],
      course: payload.sharedTo === 'course' ? payload.course || [] : [],
    });
    await post.populate('user', 'name email profileImg');
    await this.notifyPostTargets(notificationUsers, user, post, payload.sharedTo);
    return { success: true, data: post };
  }

  async getPost(id: string, user: any) {
    const docs = await this.postModel.aggregate(this.postDetailPipeline(id, user?._id ? toObjectId(user._id) : null) as any);
    if (!docs.length) throw new NotFoundException('No post found with that ID');
    return { data: this.mapPostAggregation(docs[0], false) };
  }

  async updatePost(id: string, body: any, files?: PostUploadFiles) {
    const payload = await this.withPostFiles({ ...body }, files);
    const post = await this.postModel.findByIdAndUpdate(id, payload, { new: true });
    if (!post) throw new NotFoundException('No document For this id');
    return { status: 'updated successfully', data: post };
  }

  async deletePost(id: string) {
    const post = await this.postModel.findByIdAndDelete(id);
    if (!post) throw new NotFoundException('post not found');
    await Promise.all([this.commentModel.deleteMany({ post: id }), this.reactionModel.deleteMany({ post: id })]);
    return undefined;
  }

  getComments(query: Record<string, any>, filter: Record<string, any>) {
    return this.listDocuments(this.commentModel, query, 'Comment', filter);
  }

  getReplies(id: string, query: Record<string, any>) {
    return this.getComments(query, { comment: id });
  }

  async createComment(postId: string, body: any, user: any, file?: Express.Multer.File) {
    await this.assertPostExists(postId);
    await this.assertUserSubscribed(user);
    const payload = await this.withCommentFile({ ...body, post: postId, user: user._id }, file);
    const comment = await this.commentModel.create(payload);
    const newComment = await this.commentModel.findById(comment._id).populate({ path: 'user', select: 'name profileImg' });
    return { status: 'success', data: newComment };
  }

  async replyToComment(id: string, body: any, user: any) {
    await this.assertUserSubscribed(user);
    const comment = await this.commentModel.findById(id);
    if (!comment) throw new NotFoundException('Comment Not Found');
    const reply = await this.commentModel.create({ ...body, comment: id, user: user._id });
    const newReply = await this.commentModel.findById(reply._id).populate({ path: 'user', select: 'name profileImg' });
    return { status: 'success', data: newReply };
  }

  async getComment(id: string) {
    const comment = await this.commentModel.findById(id).populate('user');
    if (!comment) throw new NotFoundException(`No document found for: ${id}`);
    return { data: comment };
  }

  async updateComment(id: string, body: any, user: any, file?: Express.Multer.File) {
    await this.assertCommentOwnerOrAdmin(id, user);
    const payload = await this.withCommentFile({ ...body }, file);
    const comment = await this.commentModel.findByIdAndUpdate(id, payload, { new: true });
    return { status: 'updated successfully', data: comment };
  }

  async deleteComment(id: string, user: any) {
    await this.assertCommentOwnerOrAdmin(id, user);
    await this.commentModel.findByIdAndDelete(id);
    return undefined;
  }

  async getReactions(postId: string | undefined, query: Record<string, any>) {
    return this.listDocuments(this.reactionModel, query, 'Reaction', postId ? { post: postId } : {});
  }

  async addReaction(postId: string, type: string, user: any) {
    if (!postId) throw new BadRequestException('Please provide a post ID.');
    const existingReaction = await this.reactionModel.findOne({ post: postId, user: user._id });
    if (existingReaction) {
      if (existingReaction.type === type) {
        await this.reactionModel.findByIdAndRemove(existingReaction._id);
        return { message: 'deleted' };
      }
      existingReaction.type = type;
      await existingReaction.save();
      return { message: 'updated', data: existingReaction };
    }
    const created = await this.reactionModel.create({ post: postId, user: user._id, type });
    return { message: 'added', data: await this.reactionModel.findById(created._id) };
  }

  async createChat(receiverId: string, user: any) {
    const existingChat = await this.chatModel.findOne({
      $and: [{ 'participants.user': user._id }, { 'participants.user': receiverId }],
      isGroupChat: false,
    });
    if (existingChat) return { message: 'Chat already exists between these users', data: existingChat };
    const newChat = await this.chatModel.create({
      participants: [
        { user: user._id, isAdmin: true },
        { user: receiverId, isAdmin: true },
      ],
    });
    await this.notificationModel.create({
      user: receiverId,
      message: { en: `${user.name} has started a chat with you`, ar: `${user.name} بدأ محادثة معك` },
      chat: newChat._id,
      type: 'chat',
    });
    return { data: newChat };
  }

  async createGroupChat(body: any, user: any, file?: Express.Multer.File) {
    const payload = { ...body };
    if (file) payload.image = await this.images.saveImageAsWebp(file, 'chats', 'GroupImage', 97);
    const groupCreatorId = String(user._id);
    const participantIds = (payload.participantIds || []).filter((participant: string) => String(participant) !== groupCreatorId);
    const participants = [...participantIds.map((participant: string) => ({ user: participant })), { user: groupCreatorId, isAdmin: true }];
    const newGroupChat = await this.chatModel.create({
      participants,
      isGroupChat: true,
      creator: user._id,
      groupName: payload.groupName,
      description: payload.description,
      image: payload.image,
    });
    await Promise.all(
      participantIds.map((participant: string) =>
        this.notificationModel.create({
          user: participant,
          message: { en: `${user.name} has added you to a group chat`, ar: `${user.name} قام بإضافتك إلى محادثة جماعية` },
          chat: newGroupChat._id,
          image: payload.image,
          type: 'chat',
        }),
      ),
    );
    return { success: true, data: newGroupChat };
  }

  getAllChats() {
    return this.chatModel.find().then((chats) => ({ data: chats }));
  }

  async getMyChats(user: any) {
    const chats = await this.chatAggregation({ 'participants.user': toObjectId(user._id) });
    return { status: 'success', results: chats.length, data: chats };
  }

  async findChat(secondPersonId: string, user: any) {
    const chat = await this.chatModel.findOne({
      $and: [{ 'participants.user': user._id }, { 'participants.user': secondPersonId }, { isGroupChat: false }],
    });
    if (!chat) throw new NotFoundException('Chat not found');
    return { data: chat };
  }

  async addParticipant(chatId: string, body: any, user: any) {
    const existingUser = await this.userModel.findOne({ email: body.userEmail });
    if (!existingUser) throw new NotFoundException('User not found');
    const chat = await this.assertGroupAdmin(chatId, user._id);
    if (chat.participants.some((participant: any) => idString(participant.user) === idString(existingUser._id))) {
      throw new BadRequestException('User is already a participant in the chat');
    }
    const updatedChat = await this.chatModel.findByIdAndUpdate(
      chatId,
      { $push: { participants: { user: existingUser._id, isAdmin: body.isAdmin } } },
      { new: true },
    );
    await this.notificationModel.create({
      user: existingUser._id,
      message: { en: `${user.name} has added you to a group chat`, ar: `${user.name} قام بإضافتك إلى محادثة جماعية` },
      chat: updatedChat._id,
      type: 'chat',
    });
    return { message: 'User added successfully' };
  }

  async removeParticipant(chatId: string, body: any, user: any) {
    const existingUser = await this.userModel.findOne({ email: body.userEmail });
    if (!existingUser) throw new NotFoundException('User not found');
    const chat = await this.assertGroupAdmin(chatId, user._id);
    if (!chat.participants.some((participant: any) => idString(participant.user) === idString(existingUser._id))) {
      throw new BadRequestException('Participant not found in the chat');
    }
    const updatedChat = await this.chatModel.findByIdAndUpdate(chatId, { $pull: { participants: { user: existingUser._id } } }, { new: true });
    await this.notificationModel.create({
      user: existingUser._id,
      message: { en: `${user.name} has removed you from a group chat`, ar: `${user.name} قام بإزالتك من محادثة جماعية` },
      chat: updatedChat._id,
      type: 'chat',
    });
    return { message: 'User removed successfully' };
  }

  async updateParticipantRole(chatId: string, body: any, user: any) {
    const existingUser = await this.userModel.findOne({ email: body.userEmail });
    if (!existingUser) throw new NotFoundException('User not found');
    const chat = await this.assertGroupAdmin(chatId, user._id);
    if (idString(chat.creator) === idString(existingUser._id)) throw new ForbiddenException("Unauthorized: Cannot update the creator's role");
    if (!chat.participants.some((participant: any) => idString(participant.user) === idString(existingUser._id))) {
      throw new NotFoundException('Participant not found in the chat');
    }
    await this.chatModel.updateOne({ _id: chatId, 'participants.user': existingUser._id }, { $set: { 'participants.$.isAdmin': body.isAdmin } });
    await this.notificationModel.create({
      user: existingUser._id,
      message: {
        en: `${user.name} has updated your role in a group chat to ${body.isAdmin ? 'admin' : 'participant'}`,
        ar: `${user.name} قام بتحديث دورك في محادثة جماعية إلى ${body.isAdmin ? 'مشرف' : 'عضو'}`,
      },
      chat: chat._id,
      type: 'chat',
    });
    return { data: 'User role updated successfully' };
  }

  async getChatDetails(chatId: string) {
    const chat = await this.chatAggregation({ _id: toObjectId(chatId) });
    if (!chat.length) throw new NotFoundException('Chat not found');
    return { status: 'success', results: 1, data: { ...chat[0], participantCount: chat[0].participants?.length || 0 } };
  }

  async updateGroupChat(chatId: string, body: any, user: any, file?: Express.Multer.File) {
    await this.assertGroupAdmin(chatId, user._id);
    const payload = { ...body };
    if (file) payload.image = await this.images.saveImageAsWebp(file, 'chats', 'GroupImage', 97);
    const updatedChat = await this.chatModel.findByIdAndUpdate(chatId, payload, { new: true, runValidators: true });
    if (!updatedChat) throw new NotFoundException('Chat not found');
    return { data: updatedChat };
  }

  async deleteChat(chatId: string) {
    const chat = await this.chatModel.findByIdAndDelete(chatId);
    if (!chat) throw new NotFoundException(`chat not found for this id ${chatId}`);
    await Promise.all([this.messageModel.deleteMany({ chat: chat._id }), this.notificationModel.deleteMany({ chat: chat._id })]);
    return undefined;
  }

  async pinMessage(chatId: string, messageId: string) {
    const chat = await this.chatModel.findById(chatId);
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.pinnedMessages.some((message: any) => idString(message) === messageId)) throw new BadRequestException('Message is already pinned in the chat');
    await this.chatModel.findByIdAndUpdate(chatId, { $push: { pinnedMessages: messageId } }, { new: true });
    return this.chatModel.findById(chatId);
  }

  async unpinMessage(chatId: string, messageId: string) {
    const chat = await this.chatModel.findById(chatId);
    if (!chat) throw new NotFoundException('Chat not found');
    if (!chat.pinnedMessages.some((message: any) => idString(message) === messageId)) throw new BadRequestException('Message is not pinned in the chat');
    await this.chatModel.findByIdAndUpdate(chatId, { $pull: { pinnedMessages: messageId } }, { new: true });
    return this.chatModel.findById(chatId);
  }

  async archiveChat(chatId: string, archived: boolean) {
    const chat = await this.chatModel.findByIdAndUpdate(chatId, { $set: { archived } }, { new: true });
    if (!chat) throw new NotFoundException('Chat not found');
    return { message: archived ? 'archived' : 'unarchived' };
  }

  async customerService(body: any, user: any) {
    const customerServiceUsers = await this.userModel.find({ isCustomerService: true });
    if (!customerServiceUsers.length) throw new NotFoundException('No customer service users available');
    const representative = customerServiceUsers[Math.floor(Math.random() * customerServiceUsers.length)];
    const newChat = await this.chatModel.create({
      participants: [{ user: user._id, isAdmin: true }, { user: representative._id }],
      isGroupChat: true,
      creator: representative._id,
      groupName: 'Customer Support',
      description: 'Chat with customer support',
    });
    const newMessage = await this.messageModel.create({ chat: newChat._id, sender: user._id, text: body.message });
    return { data: { chat: newChat, initialMessage: newMessage } };
  }

  async addUserToCourseChats(userId: string) {
    const courseChats = await this.chatModel.find({ $or: [{ type: 'course' }, { course: { $exists: true, $ne: null } }] });
    if (!courseChats.length) return { status: 'success', message: 'No course chats found', data: { addedToChats: 0 } };
    const results = await Promise.all(
      courseChats.map(async (chat: any) => {
        if (chat.participants.some((participant: any) => idString(participant.user) === userId)) return false;
        await this.chatModel.findByIdAndUpdate(chat._id, { $addToSet: { participants: { user: userId, isAdmin: true } } }, { new: true });
        return true;
      }),
    );
    return { status: 'success', message: 'User added to course chats successfully', data: { addedToChats: results.filter(Boolean).length } };
  }

  async addMessage(chatId: string, body: any, user: any, files?: MessageUploadFiles) {
    const chat = await this.assertChatParticipant(chatId, user);
    const payload = await this.withMessageFiles({ text: body.text, chat: chat._id, sender: user._id }, files);
    if (payload.text) payload.text = filterOffensiveWords(payload.text);
    const message = await this.messageModel.create(payload);
    return this.messageModel.findById(message._id);
  }

  async getMessages(chatId: string, query: Record<string, any>, user: any) {
    await this.assertChatParticipant(chatId, user);
    return this.listDocuments(this.messageModel, query, 'Message', { chat: chatId }, 'reactions.user');
  }

  async updateMessage(messageId: string, body: any, user: any, files?: MessageUploadFiles) {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    this.assertCanMutateMessage(message, user, 'update');
    const payload = await this.withMessageFiles({ ...body }, files);
    if (payload.text !== undefined && payload.text !== null) payload.text = filterOffensiveWords(payload.text);
    if (!Object.keys(payload).length) return message;
    return this.messageModel.findByIdAndUpdate(messageId, payload, { new: true });
  }

  async deleteMessage(messageId: string, user: any) {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    this.assertCanMutateMessage(message, user, 'delete');
    await this.messageModel.findByIdAndDelete(messageId);
    return { message: 'Message deleted successfully' };
  }

  async toggleMessageReaction(messageId: string, emoji: string, user: any) {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    const index = message.reactions.findIndex((reaction: any) => idString(reaction.user) === idString(user._id));
    if (index !== -1) {
      if (message.reactions[index].emoji === emoji) {
        await this.messageModel.findByIdAndUpdate(messageId, { $pull: { reactions: { user: user._id } } }, { new: true });
      } else {
        await this.messageModel.updateOne({ _id: messageId, 'reactions.user': user._id }, { $set: { 'reactions.$.emoji': emoji } });
      }
    } else {
      await this.messageModel.findByIdAndUpdate(messageId, { $push: { reactions: { user: user._id, emoji } } }, { new: true });
    }
    return { data: await this.messageModel.findById(messageId) };
  }

  async replyToMessage(messageId: string, body: any, user: any, files?: MessageUploadFiles) {
    const repliedMessage = await this.messageModel.findById(messageId);
    if (!repliedMessage) throw new NotFoundException('Message not found');
    const payload = await this.withMessageFiles({ chat: repliedMessage.chat, sender: user._id, text: body.text, repliedTo: repliedMessage._id }, files);
    if (payload.text) payload.text = filterOffensiveWords(payload.text);
    const reply = await this.messageModel.create(payload);
    if (idString(repliedMessage.sender) !== idString(user._id)) {
      await this.notificationModel.create({
        user: repliedMessage.sender._id || repliedMessage.sender,
        message: {
          en: `\n You have a new reply to your message.\n\n Message: ${payload.text}`,
          ar: `\n لديك رد جديد على رسالتك.\n\n الرسالة: ${payload.text}`,
        },
        chat: repliedMessage.chat,
        type: 'chat',
      });
    }
    return { data: await this.messageModel.findById(reply._id) };
  }

  async getRepliesToMessage(messageId: string) {
    return { data: await this.messageModel.find({ repliedTo: messageId }) };
  }

  async getLives(query: Record<string, any>, user: any, filter: Record<string, any> = {}) {
    return this.listDocuments(this.liveModel, query, 'Live', filter);
  }

  async getActiveLives(query: Record<string, any>, user: any) {
    const filter = await this.buildLiveFilter(query, user);
    return this.getLives(this.stripLiveDateQuery(query), user, filter);
  }

  async getInstructorLives(query: Record<string, any>, user: any) {
    return this.getLives(query, user, user.role === 'admin' ? {} : { instructor: user._id });
  }

  async createLive(body: any, user: any) {
    const payload = { ...body, instructor: body.instructor || user._id, creator: user._id };
    if (user.role !== 'admin') payload.status = 'pending';
    const live = await this.liveModel.create(payload);
    return { status: 'created successfully', data: live };
  }

  async getLive(id: string) {
    const live = await this.liveModel.findById(id);
    if (!live) throw new NotFoundException(`No document found for: ${id}`);
    return { data: live };
  }

  async updateLive(id: string, body: any) {
    const live = await this.liveModel.findByIdAndUpdate(id, body, { new: true });
    if (!live) throw new NotFoundException(`No document For this id ${id}`);
    return { status: 'updated successfully', data: live };
  }

  async deleteLive(id: string) {
    const live = await this.liveModel.findByIdAndDelete(id);
    if (!live) throw new NotFoundException(`No document for this id ${id}`);
    return undefined;
  }

  async sendEmailsToLiveFollowers(id: string, body: any, locale = 'en') {
    const live = await this.liveModel.findById(id);
    if (!live) throw new NotFoundException('Live not found');
    const subscribers = await this.userSubscriptionModel.find({ package: { $in: live.package }, endDate: { $gte: new Date() } });
    const users = await this.userModel.find({ _id: { $in: subscribers.map((subscriber: any) => subscriber.user) } });
    await Promise.all(
      users.map((follower: any) =>
        sendEmail({
          to: follower.email,
          subject: `Remember the live ${live.title?.en || live.title}`,
          html: this.getLiveEmailTemplate(follower, live, body.info || 'The live session will start soon, be ready', locale),
        }),
      ),
    );
    return { success: true, message: 'email has been sent to all followers of this live' };
  }

  private async listDocuments(model: Model<any>, query: Record<string, any>, modelName = '', filter: Record<string, any> = {}, populationOpt?: string) {
    const computedFilter = Object.keys(filter).length ? filter : this.filterFromQuery(query);
    const totalCount = await model.countDocuments(computedFilter);
    let mongoQuery = model.find(computedFilter);
    if (populationOpt) mongoQuery = mongoQuery.populate(populationOpt);
    const data = await new ApiQueryHelper(mongoQuery, query, '-createdAt').search(modelName).sort().limitFields().paginate();
    const currentPage = Number.parseInt(query.page, 10) || 1;
    const limit = Number.parseInt(query.limit, 10) || 50;
    const numberOfPages = Math.ceil(totalCount / limit);
    return {
      results: data.length,
      paginationResult: { totalCount, currentPage, limit, numberOfPages, nextPage: currentPage < numberOfPages ? currentPage + 1 : null },
      data,
    };
  }

  private filterFromQuery(query: Record<string, any>) {
    const filter = { ...query };
    ['page', 'sort', 'limit', 'fields', 'keyword'].forEach((key) => delete filter[key]);
    return filter;
  }

  private async withPostFiles(body: Record<string, any>, files?: PostUploadFiles) {
    if (files?.imageCover?.[0]) body.imageCover = await this.images.saveImageAsWebp(files.imageCover[0], 'posts', 'post-cover', 95);
    if (files?.images?.length) body.images = await this.images.saveManyImagesAsWebp(files.images, 'posts', 'post', 95);
    if (files?.documents?.length) body.documents = await this.saveDocuments(files.documents, 'posts', 'post');
    return body;
  }

  private async withCommentFile(body: Record<string, any>, file?: Express.Multer.File) {
    if (file) body.image = await this.images.saveImageAsWebp(file, 'commentPost', 'comment', 95);
    return body;
  }

  private async withMessageFiles(body: Record<string, any>, files?: MessageUploadFiles) {
    if (files?.media?.length) body.media = await this.saveMedia(files.media, 'messages', 'media');
    return body;
  }

  private async saveDocuments(files: Express.Multer.File[], folder: string, prefix: string) {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    return Promise.all(
      files.map(async (file, index) => {
        if (!allowed.includes(file.mimetype)) throw new BadRequestException(`File ${index + 1} is not a supported document type (PDF or Word).`);
        const extension = file.mimetype === 'application/pdf' ? '.pdf' : file.mimetype.includes('openxmlformats') ? '.docx' : '.doc';
        const filename = `${prefix}-${uuidv4()}-${Date.now()}-${index + 1}${extension}`;
        await fs.writeFile(join('uploads', folder, filename), file.buffer);
        return filename;
      }),
    );
  }

  private async saveMedia(files: Express.Multer.File[], folder: string, prefix: string) {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const names: string[] = [];
    for (const file of files) {
      if (!allowed.includes(file.mimetype)) continue;
      const filename = `${prefix}-${uuidv4()}-${Date.now()}${extname(file.originalname)}`;
      await fs.writeFile(join('uploads', folder, filename), file.buffer);
      names.push(filename);
    }
    if (!names.length) throw new BadRequestException('Unsupported file types provided. Only images, PDF, and Word documents are allowed.');
    return names;
  }

  private async assertPostAuthority(body: any, user: any) {
    if (!body.course || user.admin || user.role === 'moderator' || body.sharedTo === 'profile') return;
    const courseIds = Array.isArray(body.course) ? body.course : [body.course];
    if (!user.isInstructor) {
      await Promise.all(courseIds.map((courseId: string) => this.assertSubscribedToCoursePackage(user._id, courseId)));
      return;
    }
    const owned = await this.courseModel.exists({ _id: { $in: courseIds }, instructor: user._id });
    if (!owned) throw new ForbiddenException('You are not the instructor of this course to post on its feed');
  }

  private async assertSubscribedToCoursePackage(userId: string, courseId: string) {
    const pkg = await this.packageModel.findOne({ course: courseId }).select('_id course title instructor').setOptions({ skipPopulate: true });
    if (!pkg) throw new NotFoundException('No package found for this course');
    const subscription = await this.userSubscriptionModel.findOne({ user: userId, package: pkg._id }).select('_id package endDate');
    if (!subscription) throw new NotFoundException('You are not subscribed to this package');
    if (subscription.endDate.getTime() < Date.now()) throw new NotFoundException('Your subscription to this package has been expired');
  }

  private async assertCoursePostAccess(courseId: string, user: any) {
    if (user.role !== 'user') return;
    const pkg = await this.packageModel.findOne({ course: courseId }).select('_id course title instructor').setOptions({ skipPopulate: true }).populate({ path: 'course', select: 'title instructor' });
    if (!pkg) throw new NotFoundException('No package found for this course');
    const instructorId = pkg.instructor || pkg.course?.instructor;
    if (instructorId && idString(instructorId) === idString(user._id)) return;
    const subscription = await this.userSubscriptionModel.findOne({ user: user._id, package: pkg._id }).select('_id package endDate');
    if (!subscription) throw new NotFoundException('You are not subscribed to this package');
    if (subscription.endDate.getTime() < Date.now()) throw new NotFoundException('Your subscription to this package has been expired');
  }

  private async assertPackagePostAccess(packageId: string, user: any) {
    const pkg = await this.packageModel.findById(packageId).select('_id course title instructor').setOptions({ skipPopulate: true }).populate({ path: 'course', select: 'title instructor' });
    if (!pkg) throw new NotFoundException('package not found');
    const instructorId = pkg.instructor || pkg.course?.instructor;
    if (instructorId && idString(instructorId) === idString(user._id)) return;
    if (user.role !== 'user') return;
    const subscription = await this.userSubscriptionModel.findOne({ user: user._id, package: pkg._id }).select('_id package endDate');
    if (!subscription) throw new NotFoundException('You are not subscribed to this package');
    if (subscription.endDate.getTime() < Date.now()) throw new NotFoundException('Your subscription to this package has been expired');
  }

  private async fetchUsersFromTarget(target: 'package' | 'course', ids: string[] = []) {
    const users = await Promise.all(
      ids.map(async (id) => {
        if (target === 'package') {
          const pkg = await this.packageModel.findById(id);
          if (!pkg) throw new NotFoundException(`Target ${target} with ID ${id} not found`);
          const subscriptions = await this.userSubscriptionModel.find({ package: id, endDate: { $gte: new Date() } });
          return subscriptions.map((subscription: any) => subscription.user);
        }
        const course = await this.courseModel.findById(id);
        if (!course) throw new NotFoundException(`Target ${target} with ID ${id} not found`);
        const progresses = await this.courseProgressModel.find({ course: id });
        return progresses.map((progress: any) => progress.user);
      }),
    );
    return users.flat();
  }

  private async getUserFollowers(userId: string) {
    const users = await this.userModel.find({ following: { $elemMatch: { user: userId, notificationBell: true } } });
    return users.map((user: any) => user._id);
  }

  private async notifyPostTargets(users: any[], user: any, post: any, sharedTo: string) {
    await Promise.all(
      users.map((targetUser) =>
        this.notificationModel.create({
          user: targetUser,
          message: { en: `${user.name} has shared a new post with you`, ar: `${user.name} قام بمشاركة منشور جديد معك` },
          post: post._id,
          type: sharedTo === 'profile' ? 'follow' : 'post',
        }),
      ),
    );
  }

  private async assertPostExists(postId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post Not Found');
  }

  private async assertUserSubscribed(user: any) {
    if (user.role === 'admin') return;
    const subscription = await this.userSubscriptionModel.exists({ user: user._id, endDate: { $gte: new Date() } });
    if (!subscription) throw new NotFoundException('No active subscription found');
  }

  private async assertCommentOwnerOrAdmin(id: string, user: any) {
    const comment = await this.commentModel.findById(id);
    if (!comment) throw new NotFoundException('Comment Not Found');
    if (idString(comment.user) !== idString(user._id) && user.role !== 'admin') throw new ForbiddenException('You are not allowed to perform this action');
  }

  private async assertGroupAdmin(chatId: string, userId: string) {
    const chat = await this.chatModel.findById(chatId);
    if (!chat) throw new NotFoundException('Chat not found');
    if (!chat.isGroupChat) throw new BadRequestException('This is not a group chat');
    const loggedUser = chat.participants.find((participant: any) => idString(participant.user) === idString(userId));
    if (!loggedUser?.isAdmin) throw new ForbiddenException('Unauthorized: You are not an admin in this group');
    return chat;
  }

  private async assertChatParticipant(chatId: string, user: any) {
    const chat = await this.chatModel.findById(chatId);
    if (!chat) throw new NotFoundException('Chat not found');
    const participantIds = chat.participants.map((participant: any) => idString(participant.user));
    if (!participantIds.includes(idString(user._id)) && user.role !== 'admin') throw new ForbiddenException('You are not a participant of this chat');
    return chat;
  }

  private assertCanMutateMessage(message: any, user: any, action: 'update' | 'delete') {
    const senderMatches = idString(message.sender) === idString(user._id);
    if (!senderMatches && user.role !== 'admin') throw new ForbiddenException(`Unauthorized access: You cannot ${action} this message`);
    const sixHoursInMills = 6 * 60 * 60 * 1000;
    if (senderMatches && Date.now() - new Date(message.createdAt).getTime() > sixHoursInMills && user.role !== 'admin') {
      throw new ForbiddenException(`Unauthorized access: You cannot ${action} this message after 6 hours`);
    }
  }

  private postListPipeline(filter: Record<string, any>, loggedUserObjectId: Types.ObjectId | null, sort: Record<string, any>, skip: number, limit: number) {
    return [
      { $match: filter },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user', pipeline: [{ $project: { _id: 1, name: 1, profileImg: 1 } }] } },
      { $unwind: '$user' },
      this.reactionsLookupStage(),
      { $addFields: { reactionsCount: { $ifNull: [{ $first: '$reactionsAgg.count' }, 0] }, reactionTypes: { $ifNull: [{ $first: '$reactionsAgg.typesCount' }, {}] } } },
      ...(loggedUserObjectId ? this.loggedUserReactionStages(loggedUserObjectId) : [{ $addFields: { loggedUserReaction: null } }]),
      this.commentsCountLookupStage(),
      { $addFields: { commentsCount: { $ifNull: [{ $first: '$commentsCountArr.count' }, 0] } } },
      this.lastCommentLookupStage(),
      { $addFields: { lastComment: { $first: '$lastCommentArr' } } },
      { $project: { reactionsAgg: 0, commentsCountArr: 0, lastCommentArr: 0, loggedUserReactionArr: 0 } },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
    ];
  }

  private postDetailPipeline(id: string, loggedUserObjectId: Types.ObjectId | null) {
    return [
      { $match: { _id: toObjectId(id) } },
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user', pipeline: [{ $project: { _id: 1, name: 1, profileImg: 1 } }] } },
      { $unwind: '$user' },
      this.reactionsLookupStage(false),
      { $addFields: { reactionsCount: { $ifNull: [{ $first: '$reactionsAgg.count' }, 0] }, reactionTypes: { $ifNull: [{ $first: '$reactionsAgg.types' }, []] } } },
      this.commentsCountLookupStage(),
      { $addFields: { commentsCount: { $ifNull: [{ $first: '$commentsCountArr.count' }, 0] } } },
      this.lastCommentLookupStage(),
      { $addFields: { lastComment: { $first: '$lastCommentArr' } } },
      ...(loggedUserObjectId ? this.loggedUserReactionStages(loggedUserObjectId) : [{ $addFields: { loggedUserReaction: null } }]),
      { $project: { reactionsAgg: 0, commentsCountArr: 0, lastCommentArr: 0, loggedUserReactionArr: 0 } },
    ];
  }

  private reactionsLookupStage(groupTypesCount = true) {
    return {
      $lookup: {
        from: 'reactions',
        let: { postId: '$_id' },
        pipeline: groupTypesCount
          ? [
              { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
              { $group: { _id: '$type', count: { $sum: 1 } } },
              { $group: { _id: null, totalCount: { $sum: '$count' }, typesCount: { $push: { k: '$_id', v: '$count' } } } },
              { $project: { _id: 0, count: '$totalCount', typesCount: { $arrayToObject: '$typesCount' } } },
            ]
          : [
              { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
              { $group: { _id: null, count: { $sum: 1 }, types: { $addToSet: '$type' } } },
              { $project: { _id: 0, count: 1, types: 1 } },
            ],
        as: 'reactionsAgg',
      },
    };
  }

  private loggedUserReactionStages(loggedUserObjectId: Types.ObjectId) {
    return [
      {
        $lookup: {
          from: 'reactions',
          let: { postId: '$_id', uid: loggedUserObjectId },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$post', '$$postId'] }, { $eq: ['$user', '$$uid'] }] } } },
            { $project: { _id: 1, type: 1 } },
            { $limit: 1 },
          ],
          as: 'loggedUserReactionArr',
        },
      },
      { $addFields: { loggedUserReaction: { $first: '$loggedUserReactionArr' } } },
    ];
  }

  private commentsCountLookupStage() {
    return {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id' },
        pipeline: [{ $match: { $expr: { $eq: ['$post', '$$postId'] } } }, { $count: 'count' }],
        as: 'commentsCountArr',
      },
    };
  }

  private lastCommentLookupStage() {
    return {
      $lookup: {
        from: 'comments',
        let: { postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$post', '$$postId'] } } },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'user', pipeline: [{ $project: { _id: 1, name: 1, profileImg: 1 } }] } },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          { $project: { _id: 1, content: 1, createdAt: 1, user: 1 } },
        ],
        as: 'lastCommentArr',
      },
    };
  }

  private mapPostAggregation(post: any, documentsAsObjects: boolean) {
    const baseURL = process.env.BASE_URL;
    return {
      _id: post._id,
      user: post.user
        ? {
            _id: post.user._id,
            name: post.user.name,
            profileImg: post.user.profileImg ? `${baseURL}/users/${post.user.profileImg}` : null,
          }
        : null,
      content: post.content,
      sharedTo: post.sharedTo,
      course: post.course,
      package: post.package,
      imageCover: post.imageCover ? `${baseURL}/posts/${post.imageCover}` : null,
      images: Array.isArray(post.images) ? post.images.map((image: string) => `${baseURL}/posts/${image}`) : [],
      documents: Array.isArray(post.documents)
        ? documentsAsObjects
          ? post.documents.map((doc: string, index: number) => ({ name: `attachment_${index + 1}`, url: `${baseURL}/posts/${doc}` }))
          : post.documents.map((doc: string) => `${baseURL}/posts/${doc}`)
        : [],
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      reactionsCount: post.reactionsCount,
      reactionTypes: post.reactionTypes || (documentsAsObjects ? {} : []),
      commentsCount: post.commentsCount,
      loggedUserReaction: post.loggedUserReaction || null,
      lastComment: post.lastComment
        ? {
            _id: post.lastComment._id,
            content: post.lastComment.content,
            createdAt: post.lastComment.createdAt,
            user: post.lastComment.user
              ? {
                  _id: post.lastComment.user._id,
                  name: post.lastComment.user.name,
                  profileImg: post.lastComment.user.profileImg ? `${baseURL}/users/${post.lastComment.user.profileImg}` : null,
                }
              : null,
          }
        : null,
    };
  }

  private chatAggregation(match: Record<string, any>) {
    const baseUrl = process.env.BASE_URL || '';
    return this.chatModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'messages',
          let: { chatId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$chat', '$$chatId'] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $lookup: { from: 'users', localField: 'sender', foreignField: '_id', as: 'senderDetails' } },
            { $addFields: { media: { $map: { input: '$media', as: 'file', in: { $concat: [baseUrl, '/messages/', '$$file'] } } } } },
            { $project: { text: 1, media: 1, createdAt: 1, sender: 1, senderDetails: { $arrayElemAt: ['$senderDetails', 0] } } },
          ],
          as: 'lastMessage',
        },
      },
      { $unwind: '$participants' },
      { $lookup: { from: 'users', localField: 'participants.user', foreignField: '_id', as: 'participants.userDetails' } },
      { $unwind: '$participants.userDetails' },
      {
        $addFields: {
          'participants.userDetails.profileImg': {
            $cond: {
              if: '$participants.userDetails.profileImg',
              then: { $concat: [baseUrl, '/users/', '$participants.userDetails.profileImg'] },
              else: null,
            },
          },
        },
      },
      { $group: { _id: '$_id', participants: { $push: '$participants' }, root: { $mergeObjects: '$$ROOT' } } },
      { $replaceRoot: { newRoot: { $mergeObjects: ['$root', '$$ROOT'] } } },
      { $sort: { 'lastMessage.createdAt': -1 } },
      { $addFields: { image: { $cond: { if: '$image', then: { $concat: [baseUrl, '/chats/', '$image'] }, else: null } } } },
      { $project: { participants: 1, isGroupChat: 1, image: 1, groupName: 1, description: 1, archived: 1, lastMessage: 1, _id: 1 } },
    ]);
  }

  private async buildLiveFilter(query: Record<string, any>, user: any) {
    const filter: Record<string, any> = { status: 'active' };
    if (query.startDate && query.endDate) {
      filter.date = { $gte: new Date(query.startDate), $lte: new Date(query.endDate) };
    } else if (query.day) {
      const dayStart = new Date(query.day);
      const dayEnd = new Date(query.day);
      dayEnd.setUTCHours(23, 59, 59, 999);
      filter.date = { $gte: dayStart, $lte: dayEnd };
    } else {
      const last24hrs = new Date();
      last24hrs.setDate(last24hrs.getDate() - 1);
      filter.date = { $gte: last24hrs };
    }
    if (user.role !== 'admin') {
      const subscriptions = await this.userSubscriptionModel.find({ user: user._id, endDate: { $gte: new Date() } });
      if (!subscriptions.length) throw new NotFoundException('lives-errors.No-Subscription');
      filter.package = { $in: subscriptions.map((subscription: any) => subscription.package._id || subscription.package) };
    }
    return filter;
  }

  private stripLiveDateQuery(query: Record<string, any>) {
    const next = { ...query };
    delete next.startDate;
    delete next.endDate;
    delete next.day;
    return next;
  }

  private getLiveEmailTemplate(user: any, live: any, emailMessage: string, lang = 'en') {
    return `<p>${lang === 'ar' ? 'مرحبا بك' : 'Hello'} ${user.name}</p><p>${emailMessage}</p><p>${live.title?.[lang] || live.title}</p><a href="${live.link}">${lang === 'ar' ? 'انضم إلى البث المباشر' : 'Join Live Session'}</a>`;
  }
}

export type PostUploadFiles = {
  imageCover?: Express.Multer.File[];
  images?: Express.Multer.File[];
  documents?: Express.Multer.File[];
};

export type MessageUploadFiles = {
  media?: Express.Multer.File[];
};
