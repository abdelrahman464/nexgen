import { Module } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { PushNotificationService } from './services/push-notification.service';
import { TokenService } from './services/token.service';
import { ImageProcessingService } from './upload/image-processing.service';
import { AdminOrInstructorGuard } from './guards/admin-or-instructor.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  providers: [
    EmailService,
    PushNotificationService,
    TokenService,
    ImageProcessingService,
    AdminOrInstructorGuard,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    EmailService,
    PushNotificationService,
    TokenService,
    ImageProcessingService,
    AdminOrInstructorGuard,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
})
export class CommonModule {}
