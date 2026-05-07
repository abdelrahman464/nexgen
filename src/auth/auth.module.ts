import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { CommonModule } from '../common/common.module';
import { MarketingLogSchema } from '../marketing-revenue/marketing-revenue.schemas';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    CommonModule,
    PassportModule,
    UsersModule,
    MongooseModule.forFeature([{ name: 'MarketingLogs', schema: MarketingLogSchema, collection: 'marketinglogs' }]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
