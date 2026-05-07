import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommerceModule } from '../commerce/commerce.module';
import { CommonModule } from '../common/common.module';
import { LearningCatalogModule } from '../learning-catalog/learning-catalog.module';
import { UsersModule } from '../users/users.module';
import { InstructorProfitsService } from './instructor-profits.service';
import { MarketingAnalyticsController, MarketingController, MarketingInvoicesController, InstructorProfitsController, MarketerRatingController, LeaderBoardController } from './marketing-revenue.controller';
import { InstructorProfitsSchema, InvitationLinkAnalyticsSchema, LeaderBoardSchema, MarketerRatingSchema, MarketingLogSchema } from './marketing-revenue.schemas';
import { MarketingAnalyticsService } from './marketing-analytics.service';
import { MarketingInvoicesService } from './marketing-invoices.service';
import { MarketingService } from './marketing.service';
import { RatingLeaderboardService } from './rating-leaderboard.service';

@Module({
  imports: [
    CommonModule,
    UsersModule,
    LearningCatalogModule,
    CommerceModule,
    MongooseModule.forFeature([
      { name: 'MarketingLogs', schema: MarketingLogSchema, collection: 'marketinglogs' },
      { name: 'InstructorProfits', schema: InstructorProfitsSchema, collection: 'instructorprofits' },
      { name: 'InvitationLinkAnalytics', schema: InvitationLinkAnalyticsSchema, collection: 'invitationlinkanalytics' },
      { name: 'MarketerRating', schema: MarketerRatingSchema, collection: 'marketerratings' },
      { name: 'LeaderBoard', schema: LeaderBoardSchema, collection: 'leaderboards' },
    ]),
  ],
  controllers: [
    MarketingAnalyticsController,
    MarketingController,
    InstructorProfitsController,
    MarketingInvoicesController,
    MarketerRatingController,
    LeaderBoardController,
  ],
  providers: [MarketingAnalyticsService, MarketingService, InstructorProfitsService, MarketingInvoicesService, RatingLeaderboardService],
  exports: [MarketingAnalyticsService, MarketingService, InstructorProfitsService, MarketingInvoicesService, RatingLeaderboardService, MongooseModule],
})
export class MarketingRevenueModule {}
