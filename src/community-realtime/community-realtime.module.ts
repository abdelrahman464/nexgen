import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceModule } from '../commerce/commerce.module';
import { CommonModule } from '../common/common.module';
import { FoundationDataModule } from '../foundation-data/foundation-data.module';
import { LearningCatalogModule } from '../learning-catalog/learning-catalog.module';
import { UsersModule } from '../users/users.module';
import {
  ChatsController,
  CommentsController,
  LivesController,
  MessagesController,
  PostsController,
  ReactionsController,
} from './community-realtime.controller';
import { ChatSchema, CommentSchema, LiveSchema, MessageSchema, PostSchema, ReactionSchema } from './community-realtime.schemas';
import { CommunityRealtimeService } from './community-realtime.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeNotificationService } from './realtime-notification.service';
import { RealtimePresenceService } from './realtime-presence.service';

@Module({
  imports: [
    CommonModule,
    UsersModule,
    LearningCatalogModule,
    CommerceModule,
    FoundationDataModule,
    MongooseModule.forFeature([
      { name: 'Post', schema: PostSchema, collection: 'posts' },
      { name: 'Comment', schema: CommentSchema, collection: 'comments' },
      { name: 'Reaction', schema: ReactionSchema, collection: 'reactions' },
      { name: 'Chat', schema: ChatSchema, collection: 'chats' },
      { name: 'Message', schema: MessageSchema, collection: 'messages' },
      { name: 'Live', schema: LiveSchema, collection: 'lives' },
    ]),
  ],
  controllers: [PostsController, CommentsController, ReactionsController, ChatsController, MessagesController, LivesController],
  providers: [CommunityRealtimeService, RealtimePresenceService, RealtimeGateway, RealtimeNotificationService],
  exports: [CommunityRealtimeService, RealtimePresenceService, RealtimeGateway, RealtimeNotificationService, MongooseModule],
})
export class CommunityRealtimeModule {}
