import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminOrInstructorGuard } from '../common/guards/admin-or-instructor.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { createMulterOptions } from '../common/upload/upload.helper';
import {
  AddUserToCourseChatsDto,
  CreateCommentDto,
  CreateGroupChatDto,
  CreateLiveDto,
  CreateMessageDto,
  CreatePostDto,
  CreateReactionDto,
  CustomerServiceDto,
  MessageReactionDto,
  ParticipantDto,
  SendLiveEmailsDto,
  UpdateCommentDto,
  UpdateLiveDto,
  UpdatePostDto,
} from './dto/community-realtime.dto';
import { CommunityRealtimeService, MessageUploadFiles, PostUploadFiles } from './community-realtime.service';

const postUploadFields = [
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 30 },
  { name: 'documents', maxCount: 10 },
];

const messageUploadFields = [{ name: 'media', maxCount: 15 }];

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly community: CommunityRealtimeService) {}

  @Get('topPosters')
  getTopPosters() {
    return this.community.getTopProfilePosters();
  }

  @Get('courses/:course')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin', 'moderator')
  getCoursePosts(@Param('course', ParseObjectIdPipe) course: string, @Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.community.getCoursePosts(course, query, user);
  }

  @Get('packages/:package')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin', 'moderator')
  getPackagePosts(@Param('package', ParseObjectIdPipe) packageId: string, @Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.community.getPackagePosts(packageId, query, user);
  }

  @Get()
  getAll(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.community.getHomePosts(query, user);
  }

  @Post()
  @UseInterceptors(FileFieldsInterceptor(postUploadFields, createMulterOptions()))
  create(@Body() body: CreatePostDto, @CurrentUser() user: any, @UploadedFiles() files?: PostUploadFiles) {
    return this.community.createPost(body, user, files);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('user', 'admin', 'moderator')
  getOne(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.community.getPost(id, user);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'moderator')
  @UseInterceptors(FileFieldsInterceptor(postUploadFields, createMulterOptions()))
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdatePostDto, @UploadedFiles() files?: PostUploadFiles) {
    return this.community.updatePost(id, body, files);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'moderator')
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.community.deletePost(id);
  }
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly community: CommunityRealtimeService) {}

  @Get('replies/:id')
  getReplies(@Param('id', ParseObjectIdPipe) id: string, @Query() query: Record<string, any>) {
    return this.community.getReplies(id, query);
  }

  @Get('post/:postId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getForPost(@Param('postId', ParseObjectIdPipe) postId: string, @Query() query: Record<string, any>) {
    return this.community.getComments(query, { post: postId });
  }

  @Post('post/:postId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  createForPost(@Param('postId', ParseObjectIdPipe) postId: string, @Body() body: CreateCommentDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.community.createComment(postId, body, user, file);
  }

  @Put('replyToComment/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  reply(@Param('id', ParseObjectIdPipe) id: string, @Body() body: CreateCommentDto, @CurrentUser() user: any) {
    return this.community.replyToComment(id, body, user);
  }

  @Put('editReplyComment/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  updateReply(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateCommentDto, @CurrentUser() user: any) {
    return this.community.updateComment(id, body, user);
  }

  @Delete('deleteReplyComment/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'user')
  deleteReply(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.community.deleteComment(id, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.community.getComment(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateCommentDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.community.updateComment(id, body, user, file);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin')
  delete(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: any) {
    return this.community.deleteComment(id, user);
  }
}

@Controller('reacts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user', 'admin')
export class ReactionsController {
  constructor(private readonly community: CommunityRealtimeService) {}

  @Get('post/:postId')
  getForPost(@Param('postId', ParseObjectIdPipe) postId: string, @Query() query: Record<string, any>) {
    return this.community.getReactions(postId, query);
  }

  @Get('post')
  getAll(@Query() query: Record<string, any>) {
    return this.community.getReactions(undefined, query);
  }

  @Post('post/:postId')
  add(@Param('postId', ParseObjectIdPipe) postId: string, @Body() body: CreateReactionDto, @CurrentUser() user: any) {
    return this.community.addReaction(postId, body.type, user);
  }

  @Post('post')
  addWithoutPost(@Body() body: CreateReactionDto, @CurrentUser() user: any) {
    return this.community.addReaction('', body.type, user);
  }
}

@Controller('chats')
export class ChatsController {
  constructor(private readonly community: CommunityRealtimeService) {}

  @Post('addUserToCourseChats')
  addUserToCourseChats(@Body() body: AddUserToCourseChatsDto) {
    return this.community.addUserToCourseChats(body.userId);
  }

  @Post('customerService')
  @UseGuards(JwtAuthGuard)
  customerService(@Body() body: CustomerServiceDto, @CurrentUser() user: any) {
    return this.community.customerService(body, user);
  }

  @Get('myChats')
  @UseGuards(JwtAuthGuard)
  getMyChats(@CurrentUser() user: any) {
    return this.community.getMyChats(user);
  }

  @Get('find/:secondPersonId')
  @UseGuards(JwtAuthGuard)
  find(@Param('secondPersonId', ParseObjectIdPipe) secondPersonId: string, @CurrentUser() user: any) {
    return this.community.findChat(secondPersonId, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  createGroup(@Body() body: CreateGroupChatDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.community.createGroupChat(body, user, file);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAll() {
    return this.community.getAllChats();
  }

  @Post(':receiverId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createDirect(@Param('receiverId', ParseObjectIdPipe) receiverId: string, @CurrentUser() user: any) {
    return this.community.createChat(receiverId, user);
  }

  @Put(':chatId/addParticipant')
  @UseGuards(JwtAuthGuard)
  addParticipant(@Param('chatId', ParseObjectIdPipe) chatId: string, @Body() body: ParticipantDto, @CurrentUser() user: any) {
    return this.community.addParticipant(chatId, body, user);
  }

  @Put(':chatId/removeParticipant')
  @UseGuards(JwtAuthGuard)
  removeParticipant(@Param('chatId', ParseObjectIdPipe) chatId: string, @Body() body: ParticipantDto, @CurrentUser() user: any) {
    return this.community.removeParticipant(chatId, body, user);
  }

  @Put(':chatId/updateParticipantRole')
  @UseGuards(JwtAuthGuard)
  updateRole(@Param('chatId', ParseObjectIdPipe) chatId: string, @Body() body: ParticipantDto, @CurrentUser() user: any) {
    return this.community.updateParticipantRole(chatId, body, user);
  }

  @Get(':chatId/details')
  @UseGuards(JwtAuthGuard)
  details(@Param('chatId', ParseObjectIdPipe) chatId: string) {
    return this.community.getChatDetails(chatId);
  }

  @Put(':chatId/updateGroup')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', createMulterOptions()))
  updateGroup(@Param('chatId', ParseObjectIdPipe) chatId: string, @Body() body: CreateGroupChatDto, @CurrentUser() user: any, @UploadedFile() file?: Express.Multer.File) {
    return this.community.updateGroupChat(chatId, body, user, file);
  }

  @Post(':chatId/pin/:messageId')
  @UseGuards(JwtAuthGuard)
  pin(@Param('chatId', ParseObjectIdPipe) chatId: string, @Param('messageId', ParseObjectIdPipe) messageId: string) {
    return this.community.pinMessage(chatId, messageId);
  }

  @Delete(':chatId/unpin/:messageId')
  @UseGuards(JwtAuthGuard)
  unpin(@Param('chatId', ParseObjectIdPipe) chatId: string, @Param('messageId', ParseObjectIdPipe) messageId: string) {
    return this.community.unpinMessage(chatId, messageId);
  }

  @Put(':chatId/archive')
  @UseGuards(JwtAuthGuard)
  archive(@Param('chatId', ParseObjectIdPipe) chatId: string) {
    return this.community.archiveChat(chatId, true);
  }

  @Put(':chatId/unarchive')
  @UseGuards(JwtAuthGuard)
  unarchive(@Param('chatId', ParseObjectIdPipe) chatId: string) {
    return this.community.archiveChat(chatId, false);
  }

  @Delete(':chatId')
  @UseGuards(JwtAuthGuard)
  delete(@Param('chatId', ParseObjectIdPipe) chatId: string) {
    return this.community.deleteChat(chatId);
  }
}

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly community: CommunityRealtimeService) {}

  @Post(':messageId/reply')
  @UseInterceptors(FileFieldsInterceptor(messageUploadFields, createMulterOptions()))
  reply(@Param('messageId', ParseObjectIdPipe) messageId: string, @Body() body: CreateMessageDto, @CurrentUser() user: any, @UploadedFiles() files?: MessageUploadFiles) {
    return this.community.replyToMessage(messageId, body, user, files);
  }

  @Get(':messageId/replies')
  getReplies(@Param('messageId', ParseObjectIdPipe) messageId: string) {
    return this.community.getRepliesToMessage(messageId);
  }

  @Post(':messageId/reactions')
  react(@Param('messageId', ParseObjectIdPipe) messageId: string, @Body() body: MessageReactionDto, @CurrentUser() user: any) {
    return this.community.toggleMessageReaction(messageId, body.emoji, user);
  }

  @Put(':messageId')
  @UseInterceptors(FileFieldsInterceptor(messageUploadFields, createMulterOptions()))
  update(@Param('messageId', ParseObjectIdPipe) messageId: string, @Body() body: CreateMessageDto, @CurrentUser() user: any, @UploadedFiles() files?: MessageUploadFiles) {
    return this.community.updateMessage(messageId, body, user, files);
  }

  @Delete(':messageId')
  delete(@Param('messageId', ParseObjectIdPipe) messageId: string, @CurrentUser() user: any) {
    return this.community.deleteMessage(messageId, user);
  }

  @Post(':chatId')
  @UseInterceptors(FileFieldsInterceptor(messageUploadFields, createMulterOptions()))
  create(@Param('chatId', ParseObjectIdPipe) chatId: string, @Body() body: CreateMessageDto, @CurrentUser() user: any, @UploadedFiles() files?: MessageUploadFiles) {
    return this.community.addMessage(chatId, body, user, files);
  }

  @Get(':chatId')
  getForChat(@Param('chatId', ParseObjectIdPipe) chatId: string, @Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.community.getMessages(chatId, query, user);
  }
}

@Controller('lives')
@UseGuards(JwtAuthGuard)
export class LivesController {
  constructor(private readonly community: CommunityRealtimeService) {}

  @Put('sendEmails/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'moderator')
  sendEmails(@Param('id', ParseObjectIdPipe) id: string, @Body() body: SendLiveEmailsDto, @Req() req: Request) {
    return this.community.sendEmailsToLiveFollowers(id, body, req.locale);
  }

  @Get('getAll')
  @UseGuards(AdminOrInstructorGuard)
  getAll(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.community.getInstructorLives(query, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'user', 'moderator')
  getActive(@Query() query: Record<string, any>, @CurrentUser() user: any) {
    return this.community.getActiveLives(query, user);
  }

  @Post()
  @UseGuards(AdminOrInstructorGuard)
  create(@Body() body: CreateLiveDto, @CurrentUser() user: any) {
    return this.community.createLive(body, user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'moderator')
  getOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.community.getLive(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'moderator')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() body: UpdateLiveDto) {
    return this.community.updateLive(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'moderator')
  delete(@Param('id', ParseObjectIdPipe) id: string) {
    return this.community.deleteLive(id);
  }
}
