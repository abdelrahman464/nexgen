import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { CommunityRealtimeService } from '../src/community-realtime/community-realtime.service';
import { RealtimeGateway } from '../src/community-realtime/realtime.gateway';
import { RealtimePresenceService } from '../src/community-realtime/realtime-presence.service';
import { CreateCommentDto, CreatePostDto, CreateReactionDto } from '../src/community-realtime/dto/community-realtime.dto';
import { FcmTokenDto, PushNotificationsDto } from '../src/users/dto/user.dto';
import { UsersService } from '../src/users/users.service';

const objectId = () => new Types.ObjectId().toString();

describe('Community realtime migration smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BASE_URL = 'https://api.example.test';
  });

  it('validates post payload sharedTo values and required content', async () => {
    const dto = Object.assign(new CreatePostDto(), { sharedTo: 'invalid' });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['content', 'sharedTo']));
  });

  it('validates comment content and reaction type DTOs', async () => {
    const commentErrors = await validate(Object.assign(new CreateCommentDto(), {}));
    const reactionErrors = await validate(Object.assign(new CreateReactionDto(), { type: 'support' }));

    expect(commentErrors.map((error) => error.property)).toContain('content');
    expect(reactionErrors.map((error) => error.property)).toContain('type');
  });

  it('toggles post reaction by deleting the same reaction', async () => {
    const existing = { _id: 'reaction', type: 'like', save: jest.fn() };
    const reactionModel = {
      findOne: jest.fn().mockResolvedValue(existing),
      findByIdAndRemove: jest.fn().mockResolvedValue({}),
    };
    const service = new CommunityRealtimeService(
      {} as any,
      {} as any,
      reactionModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.addReaction(objectId(), 'like', { _id: 'user' })).resolves.toEqual({ message: 'deleted' });
    expect(reactionModel.findByIdAndRemove).toHaveBeenCalledWith('reaction');
  });

  it('rejects non-participants when listing chat messages', async () => {
    const chatModel = { findById: jest.fn().mockResolvedValue({ participants: [{ user: objectId() }] }) };
    const service = new CommunityRealtimeService(
      {} as any,
      {} as any,
      {} as any,
      chatModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.getMessages(objectId(), {}, { _id: objectId(), role: 'user' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unsupported message media when every file is skipped', async () => {
    const chatId = objectId();
    const userId = objectId();
    const chatModel = { findById: jest.fn().mockResolvedValue({ _id: chatId, participants: [{ user: userId }] }) };
    const service = new CommunityRealtimeService(
      {} as any,
      {} as any,
      {} as any,
      chatModel as any,
      { create: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.addMessage(
        chatId,
        { text: 'hello' },
        { _id: userId },
        { media: [{ mimetype: 'application/x-msdownload', originalname: 'bad.exe', buffer: Buffer.from('x') } as any] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates customer service chat with initial message', async () => {
    const representative = { _id: 'rep' };
    const userModel = { find: jest.fn().mockResolvedValue([representative]) };
    const chatModel = { create: jest.fn().mockResolvedValue({ _id: 'chat' }) };
    const messageModel = { create: jest.fn().mockResolvedValue({ _id: 'message' }) };
    const service = new CommunityRealtimeService(
      {} as any,
      {} as any,
      {} as any,
      chatModel as any,
      messageModel as any,
      {} as any,
      {} as any,
      userModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.customerService({ message: 'help' }, { _id: 'user' })).resolves.toMatchObject({
      data: { chat: { _id: 'chat' }, initialMessage: { _id: 'message' } },
    });
  });

  it('updates realtime presence and emits private message events', async () => {
    const presence = new RealtimePresenceService({ findByIdAndUpdate: jest.fn().mockResolvedValue({ timeSpent: {} }) } as any);
    const gateway = new RealtimeGateway(presence);
    gateway.server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) } as any;
    const socket = { id: 'socket-1', emit: jest.fn(), to: jest.fn() } as any;

    await gateway.addUser({ userId: 'receiver' }, { id: 'socket-2' } as any);
    gateway.sendMessage({ senderId: 'sender', receiverId: 'receiver', text: 'hello' }, socket);

    expect(gateway.server.to).toHaveBeenCalledWith('socket-2');
  });

  it('emits offline private message errors through the gateway', () => {
    const gateway = new RealtimeGateway(new RealtimePresenceService({} as any));
    gateway.server = { to: jest.fn() } as any;
    const socket = { id: 'sender-socket', emit: jest.fn(), to: jest.fn() } as any;

    gateway.sendMessage({ senderId: 'sender', receiverId: 'offline', text: 'hello' }, socket);

    expect(socket.emit).toHaveBeenCalledWith('errorMessage', 'User not found or offline.');
  });

  it('records disconnect time spent and removes online users', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-07T10:00:10Z'));
    const userModel = {
      findByIdAndUpdate: jest.fn().mockResolvedValue({ timeSpent: { monthlyStartDate: new Date('2026-05-01'), monthlyTimeSpent: 5 } }),
      findById: jest.fn().mockResolvedValue({ timeSpent: { monthlyStartDate: new Date('2026-05-01'), monthlyTimeSpent: 5 } }),
    };
    const presence = new RealtimePresenceService(userModel as any);

    presence.addUser('user', 'socket');
    await presence.recordSessionStart('user');
    jest.setSystemTime(new Date('2026-05-07T10:00:20Z'));
    await presence.recordDisconnect('socket');

    expect(userModel.findByIdAndUpdate).toHaveBeenLastCalledWith(
      'user',
      expect.objectContaining({ $inc: { 'timeSpent.totalTimeSpent': 10 } }),
      { new: true },
    );
    jest.useRealTimers();
  });

  it('migrates follow and push-notification user DTO behavior', async () => {
    const userModel = {
      findById: jest.fn().mockResolvedValue({ _id: 'target' }),
      findOne: jest.fn().mockResolvedValue(null),
      findByIdAndUpdate: jest.fn().mockResolvedValue({ pushNotificationsEnabled: false }),
    };
    const service = new UsersService(
      userModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.togglePushNotifications(false, { _id: 'user' })).resolves.toMatchObject({
      data: { pushNotificationsEnabled: false },
    });
    await expect(validate(Object.assign(new FcmTokenDto(), { fcmToken: 'abc', method: 'register' }))).resolves.toHaveLength(0);
    await expect(validate(Object.assign(new PushNotificationsDto(), { enabled: true }))).resolves.toHaveLength(0);
  });
});
