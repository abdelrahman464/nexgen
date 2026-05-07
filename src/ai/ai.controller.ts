import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Put, Query, Req, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AiChatService } from './ai-chat.service';
import { AiKnowledgeService } from './ai-knowledge.service';
import { IdentityVerificationService } from './identity-verification.service';
import { AiChatDto, CreateAiChatSessionDto, CreateAiKnowledgeDto, IdDocumentActionDto, SyncActionDto, SyncSelectedDto, UpdateAiKnowledgeDto } from './dto/ai.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ApiException } from '../common/exceptions/api.exception';
import { createMulterOptions } from '../common/upload/upload.helper';

const chatRateLimits = new Map<string, { count: number; resetAt: number }>();

@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly service: AiChatService) {}

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  getSessions(@CurrentUser() user: any) {
    return this.service.getSessions(user);
  }

  @Post('sessions')
  @UseGuards(JwtAuthGuard)
  createSession(@CurrentUser() user: any, @Body() body: CreateAiChatSessionDto) {
    return this.service.createSession(user, body.title);
  }

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard)
  getSession(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getSession(id, user);
  }

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  chat(@Body() body: AiChatDto, @CurrentUser() user: any, @Req() req: Request, @Headers('x-ai-guest-key') guestKey: string) {
    this.assertRateLimit(user?._id?.toString() || req.ip || 'anonymous');
    return this.service.chat(body, user, String(req.headers['accept-language'] || 'en'), guestKey);
  }

  private assertRateLimit(key: string) {
    const now = Date.now();
    const current = chatRateLimits.get(key);
    if (!current || current.resetAt <= now) {
      chatRateLimits.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return;
    }
    if (current.count >= 20) throw new ApiException('Too many AI chat requests, please try again later.', 429);
    current.count += 1;
  }
}

@Controller('ai-knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiKnowledgeController {
  constructor(private readonly service: AiKnowledgeService) {}

  @Get('sync-status')
  syncStatus() {
    return this.service.syncStatus();
  }

  @Get('sync-logs')
  syncLogs(@Query() query: Record<string, any>) {
    return this.service.syncLogs(query);
  }

  @Post('sync-selected')
  syncSelected(@Body() body: SyncSelectedDto, @CurrentUser() user: any) {
    return this.service.syncSelected(body, user);
  }

  @Post('sync-pending')
  syncPending(@Body() body: SyncActionDto, @CurrentUser() user: any) {
    return this.service.syncPending(body, user);
  }

  @Post('retry-failed')
  retryFailed(@Body() body: SyncActionDto, @CurrentUser() user: any) {
    return this.service.retryFailed(body, user);
  }

  @Post('full-rebuild')
  fullRebuild(@Body() body: SyncActionDto, @CurrentUser() user: any) {
    return this.service.fullRebuild(body, user);
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.service.list(query);
  }

  @Post()
  create(@Body() body: CreateAiKnowledgeDto) {
    return this.service.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateAiKnowledgeDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}

@Controller('users/idDocument')
export class AiIdentityController {
  constructor(private readonly service: IdentityVerificationService) {}

  @Post('upload')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'idDocuments', maxCount: 4 }], createMulterOptions()))
  upload(@Headers('authorization') authorization: string, @UploadedFiles() files: Record<string, Express.Multer.File[]>) {
    return this.service.uploadIdDocument(authorization, files);
  }

  @Post('verify/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user')
  verify(@Param('userId') userId: string) {
    return this.service.verifyIdentityWithAI(userId);
  }

  @Put(':id/action')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  action(@Param('id') id: string, @Body() body: IdDocumentActionDto) {
    return this.service.actionOnIdDocument(id, body);
  }
}
