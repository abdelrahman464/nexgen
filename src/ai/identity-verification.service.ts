import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import jwt from 'jsonwebtoken';
import { Model } from 'mongoose';
import { OpenAiProviderService } from './open-ai-provider.service';
import { ApiException } from '../common/exceptions/api.exception';
import { ImageProcessingService } from '../common/upload/image-processing.service';

@Injectable()
export class IdentityVerificationService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
    private readonly openAi: OpenAiProviderService,
    private readonly images: ImageProcessingService,
  ) {}

  async uploadIdDocument(authorization: string | undefined, files: Record<string, Express.Multer.File[]>) {
    const token = this.extractBearerToken(authorization);
    if (!token) throw new UnauthorizedException('You are not logged in. Please log in to get access');
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET_KEY || process.env.JWT_SECRET || 'secret');
    const user = await this.userModel.findById(decoded.userId || decoded.id);
    if (!user) throw new UnauthorizedException('The user that belong to this token does no longer exist');
    if (user.passwordChangedAt && decoded.iat && new Date(user.passwordChangedAt).getTime() / 1000 > decoded.iat) {
      throw new UnauthorizedException('User recently changed password! Please login again.');
    }
    if (user.active === false) throw new ApiException('Your account is deactivated', 405);
    if (user.idVerification === 'verified') throw new BadRequestException('ID documents already verified');
    const idFiles = files?.idDocuments || [];
    if (!idFiles.length) throw new BadRequestException('Please upload ID document images');
    const idDocuments = await this.images.saveManyImagesAsWebp(idFiles, 'users/idDocuments', 'idDocuments', 95);
    const verification = await this.verifyUserIdentity(user._id, idDocuments, { name: user.name, idNumber: user.idNumber });
    const updateData = {
      idDocuments,
      idVerification: 'pending',
      note: null,
      ...(verification.shouldVerify && verification.updateData ? verification.updateData : {}),
    };
    await this.userModel.findByIdAndUpdate(user._id, updateData);
    if (updateData.idVerification === 'verified' || updateData.idVerification === 'rejected') {
      await this.sendStatusNotification(user._id, updateData.idVerification);
    }
    return {
      status: 'success',
      message: 'ID documents uploaded successfully',
      data: {
        idVerification: updateData.idVerification,
        idDocuments,
        note: updateData.note,
        aiVerification: verification.verificationResult,
      },
    };
  }

  async verifyIdentityWithAI(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (!user.idDocuments?.length) throw new BadRequestException('No ID documents uploaded');
    const verification = await this.verifyUserIdentity(user._id, user.idDocuments, { name: user.name, idNumber: user.idNumber });
    if (!verification.shouldVerify || !verification.updateData) {
      throw new ApiException(verification.verificationResult?.message || 'OpenAI API key is not configured', 400);
    }
    const updatedUser = await this.userModel.findByIdAndUpdate(user._id, verification.updateData, { new: true });
    if (verification.updateData.idVerification === 'verified' || verification.updateData.idVerification === 'rejected') {
      await this.sendStatusNotification(user._id, verification.updateData.idVerification);
    }
    return {
      status: 'success',
      message: 'Identity verification completed',
      data: {
        user: updatedUser,
        verification: verification.verificationResult,
        verificationStatus: verification.updateData.idVerification,
      },
    };
  }

  async actionOnIdDocument(id: string, body: Record<string, any>) {
    if (body.action === 'verified' && (!body.idNumber || !body.name)) {
      throw new BadRequestException('ID number and name are required when verifying ID document');
    }
    const updateData = {
      idVerification: body.action,
      note: body.note || null,
      ...(body.idNumber ? { idNumber: body.idNumber } : {}),
      ...(body.name ? { name: body.name } : {}),
    };
    const user = await this.userModel.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    if (!user) throw new NotFoundException('User not found');
    await this.sendStatusNotification(user._id, body.action);
    return { status: 'success', data: { user } };
  }

  async verifyUserIdentity(userId: any, idDocuments: string[], userData: Record<string, any> = {}) {
    if (!this.openAi.apiKey || this.openAi.apiKey === 'your-openai-api-key-here') {
      return { updateData: null, verificationResult: { status: 'error', message: 'OpenAI API key is not configured' }, shouldVerify: false };
    }
    try {
      const response = await this.openAi.verifyIdentityWithVision(idDocuments, userData);
      const parsed = this.parseVisionResponse(response);
      const duplicateId = parsed.extractedIdNumber ? await this.hasDuplicateIdNumber(userId, parsed.extractedIdNumber) : false;
      const status = duplicateId ? 'rejected' : this.mapVerificationStatus(parsed);
      const issues = [...(parsed.issues || []), ...(duplicateId ? ['ID number is already used by another account'] : [])];
      const updateData: Record<string, any> = {
        idVerification: status,
        note: this.noteForStatus(status, parsed, issues),
      };
      if (status === 'verified' || (status === 'pending' && Number(parsed.confidence) >= 80)) {
        if (parsed.extractedIdNumber && !duplicateId) updateData.idNumber = parsed.extractedIdNumber;
        if (parsed.extractedName) updateData.name = parsed.extractedName;
      }
      return {
        updateData,
        verificationResult: {
          status,
          confidence: parsed.confidence || 0,
          extractedName: parsed.extractedName || null,
          extractedIdNumber: parsed.extractedIdNumber || null,
          issues,
          message: this.resultMessage(status),
        },
        shouldVerify: true,
      };
    } catch (error: any) {
      return {
        updateData: { idVerification: 'pending', note: 'AI verification failed, will be reviewed manually' },
        verificationResult: { status: 'error', message: error.message || 'AI verification failed' },
        shouldVerify: false,
      };
    }
  }

  parseVisionResponse(response: any) {
    const raw = response?.choices?.[0]?.message?.content;
    if (!raw) throw new ApiException('AI verification returned an empty response', 502);
    const jsonText = String(raw).replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(jsonText);
    return {
      ...parsed,
      confidence: Number(parsed.confidence) || 0,
      issues: Array.isArray(parsed.issues) ? parsed.issues : parsed.issues ? [String(parsed.issues)] : [],
      verificationStatus: parsed.verificationStatus || parsed.status || 'needs_review',
    };
  }

  private extractBearerToken(authorization?: string) {
    if (!authorization || !authorization.startsWith('Bearer ')) return '';
    return authorization.split(' ')[1];
  }

  private async hasDuplicateIdNumber(userId: any, idNumber: string) {
    const normalized = String(idNumber).replace(/\s+/g, '').toLowerCase();
    const existing = await this.userModel.findOne({ idNumber, _id: { $ne: userId } }).select('_id idNumber').lean();
    return Boolean(existing && String(existing.idNumber || '').replace(/\s+/g, '').toLowerCase() === normalized);
  }

  private mapVerificationStatus(parsed: any) {
    const rawStatus = String(parsed.verificationStatus || '').toLowerCase();
    if (rawStatus === 'verified' && parsed.isAuthentic !== false && Number(parsed.confidence) >= 75) return 'verified';
    if (rawStatus === 'rejected' || parsed.isAuthentic === false || Number(parsed.confidence) < 45) return 'rejected';
    return 'pending';
  }

  private noteForStatus(status: string, parsed: any, issues: string[]) {
    if (status === 'verified') return 'Verified automatically using AI';
    if (status === 'rejected') return `Rejected: ${issues.join(', ') || 'ID document verification failed'}`;
    return `Needs manual review. Confidence: ${parsed.confidence || 0}%${issues.length ? `. Issues: ${issues.join(', ')}` : ''}`;
  }

  private resultMessage(status: string) {
    if (status === 'verified') return 'Identity verified automatically using AI';
    if (status === 'rejected') return 'Identity document rejected by AI verification';
    return 'Identity document needs manual review';
  }

  private async sendStatusNotification(userId: any, status: string) {
    await this.notificationModel.create({
      user: userId,
      type: 'system',
      message:
        status === 'verified'
          ? {
              ar: 'تهانينا! تم التحقق من هويتك تلقائياً',
              en: 'Congratulations! Your identity has been verified automatically',
            }
          : {
              ar: 'تم رفض الوثائق الخاصة بك يرجى تحميل وثيقة صالحة',
              en: 'Your ID documents have been rejected please upload a valid one',
            },
    });
  }
}
