import { Module } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { PushNotificationService } from './services/push-notification.service';
import { TokenService } from './services/token.service';
import { ImageProcessingService } from './upload/image-processing.service';

@Module({
  providers: [EmailService, PushNotificationService, TokenService, ImageProcessingService],
  exports: [EmailService, PushNotificationService, TokenService, ImageProcessingService],
})
export class CommonModule {}
