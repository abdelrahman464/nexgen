import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

type OnlineUser = {
  userId: string;
  socketId: string;
  roomId?: string | null;
};

@Injectable()
export class RealtimePresenceService {
  private users: OnlineUser[] = [];
  private readonly userSessions = new Map<string, number>();

  constructor(@InjectModel('User') private readonly userModel: Model<any>) {}

  getUserSocketId(userId: string) {
    return this.users.find((user) => user.userId === userId)?.socketId || null;
  }

  addUser(userId: string, socketId: string, roomId: string | null = null) {
    const user = this.users.find((item) => item.userId === userId);
    if (user) {
      user.socketId = socketId;
      user.roomId = roomId;
      return;
    }
    this.users.push({ userId, socketId, roomId });
  }

  findBySocket(socketId: string) {
    return this.users.find((user) => user.socketId === socketId) || null;
  }

  removeUser(socketId: string) {
    this.users = this.users.filter((user) => user.socketId !== socketId);
  }

  async recordSessionStart(userId: string) {
    this.userSessions.set(userId, Date.now());
    try {
      const user = await this.userModel.findByIdAndUpdate(userId, { 'timeSpent.lastLogin': new Date() }, { new: true });
      if (user && !user.timeSpent?.monthlyStartDate) {
        await this.userModel.findByIdAndUpdate(userId, { 'timeSpent.monthlyStartDate': new Date() }, { new: true });
      }
    } catch (error) {
      console.error(`Error updating user data for userId ${userId}:`, error);
    }
  }

  async recordDisconnect(socketId: string) {
    const disconnectedUser = this.findBySocket(socketId);
    if (!disconnectedUser) return null;
    const { userId } = disconnectedUser;
    const sessionStart = this.userSessions.get(userId);
    if (sessionStart) {
      const sessionDuration = Math.floor((Date.now() - sessionStart) / 1000);
      await this.updateUserTimeSpent(userId, sessionDuration);
      this.userSessions.delete(userId);
    }
    this.removeUser(socketId);
    return disconnectedUser;
  }

  private async updateUserTimeSpent(userId: string, sessionDuration: number) {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) return;
      const now = new Date();
      let monthlyStartDate = user.timeSpent?.monthlyStartDate;
      let monthlyTimeSpent = user.timeSpent?.monthlyTimeSpent || 0;
      if (!monthlyStartDate) {
        monthlyStartDate = now;
        monthlyTimeSpent = 0;
      } else {
        monthlyStartDate = new Date(monthlyStartDate);
      }
      const isDifferentMonth = now.getFullYear() !== monthlyStartDate.getFullYear() || now.getMonth() !== monthlyStartDate.getMonth();
      if (isDifferentMonth) {
        monthlyTimeSpent = sessionDuration;
        monthlyStartDate = now;
      } else {
        monthlyTimeSpent += sessionDuration;
      }
      await this.userModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            'timeSpent.monthlyStartDate': monthlyStartDate,
            'timeSpent.monthlyTimeSpent': monthlyTimeSpent,
          },
          $inc: { 'timeSpent.totalTimeSpent': sessionDuration },
        },
        { new: true },
      );
    } catch (error) {
      console.error(`Error updating user time for userId ${userId}:`, error);
    }
  }
}
