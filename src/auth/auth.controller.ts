import { Body, Controller, Get, HttpCode, Post, Put, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import passport from 'passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { createMulterOptions } from '../common/upload/upload.helper';
import { UserUploadFiles } from '../users/users.service';
import { AdminIssueUserTokenDto, ForgotPasswordDto, GoogleMobileDto, LoginDto, ResendEmailCodeDto, ResetPasswordDto, SignupDto, VerifyEmailDto, VerifyResetCodeDto } from './dto/auth.dto';
import { AuthService } from './auth.service';

const userUploadFields = [
  { name: 'profileImg', maxCount: 1 },
  { name: 'coverImg', maxCount: 1 },
  { name: 'signatureImage', maxCount: 1 },
  { name: 'idDocuments', maxCount: 3 },
];

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google')
  google(@Req() req: any, @Res() res: any) {
    this.auth.ensureGoogleStrategy();
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res);
  }

  @Get('google/callback')
  googleCallback(@Req() req: any, @Res() res: any) {
    this.auth.ensureGoogleStrategy();
    passport.authenticate('google', { failureRedirect: '/login' }, (error: unknown, result: any) => {
      if (error || !result?.token) {
        return res.redirect('https://nexgen-academy.com/en/login?error=authenticationFailed');
      }
      return res.redirect(`https://nexgen-academy.com/en/callback/google?token=${result.token}`);
    })(req, res);
  }

  @Post('signup')
  @UseInterceptors(FileFieldsInterceptor(userUploadFields, createMulterOptions()))
  signup(@Body() body: SignupDto, @UploadedFiles() files?: UserUploadFiles) {
    return this.auth.signup(body, files);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto) {
    return this.auth.login(body);
  }

  @Post('forgotPassword')
  @HttpCode(200)
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.auth.forgotPassword(body.email);
  }

  @Post('verifyResetCode')
  @HttpCode(200)
  verifyResetCode(@Body() body: VerifyResetCodeDto) {
    return this.auth.verifyResetCode(body.resetCode);
  }

  @Put('resetPassword')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.email, body.newPassword);
  }

  @Post('verifyEmail')
  @HttpCode(200)
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.auth.verifyEmail(body.code);
  }

  @Post('resendEmailCode')
  @HttpCode(200)
  resendEmailCode(@Body() body: ResendEmailCodeDto) {
    return this.auth.resendEmailCode(body.email);
  }

  @Get('getMe')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: any) {
    return this.auth.getMe(user._id);
  }

  @Post('admin/issue-user-token')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminIssueUserToken(@Body() body: AdminIssueUserTokenDto) {
    return this.auth.adminIssueUserToken(body.userId);
  }

  @Post('google/mobile')
  @HttpCode(200)
  googleMobile(@Body() body: GoogleMobileDto) {
    return this.auth.googleMobileAuth(body.idToken);
  }
}
