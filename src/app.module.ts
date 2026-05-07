import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import appConfig from './config/app.config';
import { validateEnv } from './config/env.validation';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { FoundationDataModule } from './foundation-data/foundation-data.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LearningCatalogModule } from './learning-catalog/learning-catalog.module';
import { CommerceModule } from './commerce/commerce.module';
import { MarketingRevenueModule } from './marketing-revenue/marketing-revenue.module';
import { CommunityRealtimeModule } from './community-realtime/community-realtime.module';

const databaseImports =
  process.env.SKIP_DB_CONNECTION === 'true' || process.env.NODE_ENV === 'test'
    ? []
    : [DatabaseModule, UsersModule, AuthModule, LearningCatalogModule, CommerceModule, MarketingRevenueModule, CommunityRealtimeModule, FoundationDataModule];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'config.env',
      load: [appConfig],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    HealthModule,
    ...databaseImports,
  ],
})
export class AppModule {}
