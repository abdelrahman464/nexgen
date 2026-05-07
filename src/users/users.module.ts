import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { ChatSchema, CommentSchema, LiveSchema, MessageSchema, ReactionSchema } from '../community-realtime/community-realtime.schemas';
import { OrderSchema } from '../commerce/commerce.schemas';
import { ArticalSchema, NotificationSchema } from '../foundation-data/foundation-data.schemas';
import { CoursePackageSchema, CourseProgressSchema, CourseSchema, PackageSchema } from '../learning-catalog/catalog.schemas';
import { MarketingLogSchema } from '../marketing-revenue/marketing-revenue.schemas';
import { UserSchema } from './user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    CommonModule,
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchema, collection: 'users' },
      { name: 'Order', schema: OrderSchema, collection: 'orders' },
      { name: 'Message', schema: MessageSchema, collection: 'messages' },
      { name: 'Chat', schema: ChatSchema, collection: 'chats' },
      { name: 'Notification', schema: NotificationSchema, collection: 'notifications' },
      { name: 'Reaction', schema: ReactionSchema, collection: 'reactions' },
      { name: 'Comment', schema: CommentSchema, collection: 'comments' },
      { name: 'CourseProgress', schema: CourseProgressSchema, collection: 'courseprogresses' },
      { name: 'MarketingLogs', schema: MarketingLogSchema, collection: 'marketinglogs' },
      { name: 'Course', schema: CourseSchema, collection: 'courses' },
      { name: 'Artical', schema: ArticalSchema, collection: 'articals' },
      { name: 'Package', schema: PackageSchema, collection: 'packages' },
      { name: 'CoursePackage', schema: CoursePackageSchema, collection: 'coursepackages' },
      { name: 'Live', schema: LiveSchema, collection: 'lives' },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
