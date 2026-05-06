import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';

const mongooseI18nLocalize = require('mongoose-i18n-localize');

mongoose.plugin(mongooseI18nLocalize, {
  locales: [process.env.FIRST_LANGUAGE || 'ar', process.env.SECOND_LANGUAGE || 'en'],
});
mongoose.set('strictQuery', false);

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
    }),
  ],
})
export class DatabaseModule {}
