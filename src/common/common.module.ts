import { Module } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { PushNotificationService } from './services/push-notification.service';
import { TokenService } from './services/token.service';

@Module({
  providers: [EmailService, PushNotificationService, TokenService],
  exports: [EmailService, PushNotificationService, TokenService],
})
export class CommonModule {}
