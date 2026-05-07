import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from '../common/common.module';
import { CommerceModule } from '../commerce/commerce.module';
import { FoundationDataModule } from '../foundation-data/foundation-data.module';
import { LearningCatalogModule } from '../learning-catalog/learning-catalog.module';
import { UsersModule } from '../users/users.module';
import { AiChatController, AiIdentityController, AiKnowledgeController } from './ai.controller';
import { AiChatService } from './ai-chat.service';
import { AiKnowledgeSyncLogSchema, AiChatSessionSchema, AiKnowledgeSchema } from './ai.schemas';
import { AiKnowledgeService } from './ai-knowledge.service';
import { IdentityVerificationService } from './identity-verification.service';
import { OpenAiProviderService } from './open-ai-provider.service';

@Module({
  imports: [
    CommonModule,
    UsersModule,
    LearningCatalogModule,
    CommerceModule,
    FoundationDataModule,
    MongooseModule.forFeature([
      { name: 'AiChatSession', schema: AiChatSessionSchema, collection: 'aichatsessions' },
      { name: 'AiKnowledge', schema: AiKnowledgeSchema, collection: 'aiknowledges' },
      { name: 'AiKnowledgeSyncLog', schema: AiKnowledgeSyncLogSchema, collection: 'aiknowledgesynclogs' },
    ]),
  ],
  controllers: [AiChatController, AiKnowledgeController, AiIdentityController],
  providers: [OpenAiProviderService, AiChatService, AiKnowledgeService, IdentityVerificationService],
  exports: [OpenAiProviderService, AiChatService, AiKnowledgeService, IdentityVerificationService, MongooseModule],
})
export class AiModule {}
