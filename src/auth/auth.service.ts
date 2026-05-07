import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Model } from 'mongoose';
import passport from 'passport';
import { ApiException } from '../common/exceptions/api.exception';
import { EmailService } from '../common/services/email.service';
import { TokenService } from '../common/services/token.service';
import { UsersService, UserUploadFiles } from '../users/users.service';

const GoogleStrategy = require('passport-google-oauth20').Strategy;

@Injectable()
export class AuthService {
  private googleStrategyRegistered = false;

  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    private readonly users: UsersService,
    private readonly emails: EmailService,
    private readonly tokens: TokenService,
  ) {}

  async signup(body: any, files?: UserUploadFiles) {
    await this.users.assertEmailAvailable(body.email);
    const invitation = await this.resolveInvitation(body.invitationKey);
    const payload = await this.users.withUploadedImages(
      {
        ...body,
        invitor: invitation.invitorId,
        coach: invitation.coachId,
        active: true,
      },
      files,
    );
    delete payload.passwordConfirm;

    const user = await this.userModel.create(payload);
    await this.setAndSendEmailVerification(user);
    return { data: user, token: this.tokens.generateToken(user._id.toString()) };
  }

  async login(body: any) {
    const user = await this.userModel.findOne({ email: body.email }).select('+password');
    if (!user || !(await bcrypt.compare(body.password, user.password))) {
      throw new UnauthorizedException('incorrect password or email');
    }
    user.idDocuments = undefined;
    return { data: user, token: this.tokens.generateToken(user._id.toString()) };
  }

  async adminIssueUserToken(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('no user found for this id');
    user.idDocuments = undefined;
    return { data: user, token: this.tokens.generateToken(user._id.toString()) };
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new NotFoundException(`There is no user with email ${email}`);

    const resetCode = this.createSixDigitCode();
    await this.userModel.updateOne(
      { email },
      {
        passwordResetCode: this.hashCode(resetCode),
        passwordResetExpires: Date.now() + 10 * 60 * 1000,
        passwordResetVerified: false,
      },
    );

    try {
      await this.emails.send({
        to: user.email,
        subject: 'Your Password Reset Code (valid for 10 minutes)',
        html: this.codeEmail(user.name, resetCode, 'Password Reset Verification Code'),
      });
    } catch (error) {
      await this.userModel.updateOne(
        { email },
        { $unset: { passwordResetCode: '', passwordResetExpires: '', passwordResetVerified: '' } },
      );
      throw new ApiException(error instanceof Error ? error.message : 'Failed to send reset email', 500);
    }

    return {
      status: 'success',
      message: `Reset Code Sent Successfully To ${user.email}`,
    };
  }

  async verifyResetCode(resetCode: string) {
    const user = await this.userModel.findOne({
      passwordResetCode: this.hashCode(resetCode),
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) throw new BadRequestException('Reset code invalid or expired');
    await this.userModel.updateOne({ _id: user._id }, { passwordResetVerified: true });
    return { status: 'success' };
  }

  async resetPassword(email: string, newPassword: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new NotFoundException(`There is no user with that email ${email}`);
    if (!user.passwordResetVerified) throw new BadRequestException('Reset code not verified');

    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: { password: await bcrypt.hash(newPassword, 12), passwordChangedAt: Date.now() },
        $unset: { passwordResetCode: '', passwordResetExpires: '', passwordResetVerified: '' },
      },
    );
    return { user, token: this.tokens.generateToken(user._id.toString()) };
  }

  async verifyEmail(code: string) {
    const user = await this.userModel.findOne({
      emailVerificationCode: this.hashCode(code),
      emailVerificationExpires: { $gt: Date.now() },
    });
    if (!user) throw new BadRequestException('Email code invalid or expired');
    await this.userModel.updateOne(
      { _id: user._id },
      {
        $set: { emailVerified: true, active: true },
        $unset: { emailVerificationCode: '', emailVerificationExpires: '' },
      },
    );
    return { status: 'success' };
  }

  async resendEmailCode(email: string) {
    const user = await this.userModel.findOne({ email, emailVerified: false });
    if (!user) {
      throw new NotFoundException(`There is no user with email ${email} or email already verified`);
    }
    await this.setAndSendEmailVerification(user);
    return {
      status: 'success',
      message: `Email Verification Code Sent Successfully To ${user.email}`,
    };
  }

  async getMe(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return { status: 'success', data: user };
  }

  async googleMobileAuth(idToken: string) {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const googleId = payload?.sub;
      const email = payload?.email;
      const name = payload?.name;
      if (!googleId || !email) throw new BadRequestException('Email not provided by Google');
      return this.findOrCreateGoogleUser(googleId, email, name || email);
    } catch (error) {
      if (error instanceof ApiException || error instanceof BadRequestException) throw error;
      throw new UnauthorizedException('Invalid Google token or authentication failed');
    }
  }

  ensureGoogleStrategy() {
    if (this.googleStrategyRegistered) return;
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL,
          passReqToCallback: true,
        },
        async (_req: unknown, _accessToken: string, _refreshToken: string, profile: any, done: Function) => {
          try {
            const result = await this.findOrCreateGoogleUser(profile.id, profile.emails[0].value, profile.displayName);
            done(null, result);
          } catch (error) {
            done(error);
          }
        },
      ),
    );
    this.googleStrategyRegistered = true;
  }

  async findOrCreateGoogleUser(googleId: string, email: string, name: string) {
    let existingUser = await this.userModel.findOne({
      $or: [{ 'google.id': googleId }, { email }],
    });

    if (existingUser) {
      if (!existingUser.google?.id) {
        await this.userModel.updateOne(
          { _id: existingUser._id },
          {
            $set: {
              'google.id': googleId,
              'google.email': email,
              isOAuthUser: true,
            },
          },
        );
        existingUser = await this.userModel.findById(existingUser._id);
      }
      const userResponse = existingUser.toObject ? existingUser.toObject() : existingUser;
      delete userResponse.password;
      delete userResponse.idDocuments;
      return { user: userResponse, token: this.tokens.generateToken(existingUser._id.toString()) };
    }

    const newUser = await this.userModel.create({
      name,
      email,
      google: { id: googleId, email },
      isOAuthUser: true,
      emailVerified: true,
      active: true,
    });
    const userResponse = newUser.toObject ? newUser.toObject() : newUser;
    delete userResponse.password;
    delete userResponse.idDocuments;
    return { user: userResponse, token: this.tokens.generateToken(newUser._id.toString()) };
  }

  private async resolveInvitation(invitationKey?: string) {
    if (!invitationKey) {
      return { invitorId: process.env.ADMIN_ID, coachId: process.env.ADMIN_ID };
    }

    const { getMarketerFromInvitationKey } = require('../../services/marketing/marketingAnalyticsService');
    const { marketerId, marketLog } = await getMarketerFromInvitationKey(invitationKey);
    if (!marketerId) throw new BadRequestException('this link is invalid');
    return {
      invitorId: marketLog.marketer,
      coachId: marketLog.role === 'affiliate' ? marketLog.fallBackCoach : marketLog.marketer,
    };
  }

  private async setAndSendEmailVerification(user: any) {
    const verificationCode = this.createSixDigitCode();
    await this.userModel.updateOne(
      { email: user.email },
      {
        emailVerificationCode: this.hashCode(verificationCode),
        emailVerificationExpires: Date.now() + 10 * 60 * 1000,
      },
    );
    await this.emails.send({
      to: user.email,
      subject: 'Your Email Verification Code (valid for 10 minutes)',
      html: this.codeEmail(user.name, verificationCode, 'Account Verification Code'),
    });
  }

  private createSixDigitCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hashCode(code: string) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private codeEmail(name: string, code: string, title: string) {
    return `
      <html>
        <body>
          <p>Hello, ${name}</p>
          <h2>${title}</h2>
          <p>${code}</p>
        </body>
      </html>
    `;
  }
}
