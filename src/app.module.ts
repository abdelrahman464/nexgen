import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import appConfig from './config/app.config';
import { validateEnv } from './config/env.validation';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { FoundationDataModule } from './foundation-data/foundation-data.module';
import { HealthModule } from './health/health.module';

const databaseImports =
  process.env.SKIP_DB_CONNECTION === 'true' || process.env.NODE_ENV === 'test'
    ? []
    : [DatabaseModule, FoundationDataModule];

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
