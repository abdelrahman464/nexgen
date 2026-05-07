import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimePresenceService } from './realtime-presence.service';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly presence: RealtimePresenceService) {}

  handleConnection() {
    return undefined;
  }

  async handleDisconnect(socket: Socket) {
    const disconnectedUser = await this.presence.recordDisconnect(socket.id);
    if (disconnectedUser) console.log(`User disconnected: ${disconnectedUser.userId}`);
  }

  @SubscribeMessage('addUser')
  async addUser(@MessageBody() body: { userId: string }, @ConnectedSocket() socket: Socket) {
    this.presence.addUser(body.userId, socket.id);
    console.log(`User ${body.userId} connected`);
    await this.presence.recordSessionStart(body.userId);
  }

  @SubscribeMessage('joinRoom')
  joinRoom(@MessageBody() body: { userId: string; roomId: string }, @ConnectedSocket() socket: Socket) {
    this.presence.addUser(body.userId, socket.id, body.roomId);
    socket.join(body.roomId);
    console.log(`User ${body.userId} joined room ${body.roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  leaveRoom(@MessageBody() body: { userId: string; roomId: string }, @ConnectedSocket() socket: Socket) {
    socket.leave(body.roomId);
    console.log(`User ${body.userId} left room ${body.roomId}`);
  }

  @SubscribeMessage('sendMessage')
  sendMessage(@MessageBody() body: any, @ConnectedSocket() socket: Socket) {
    if (body.roomId) {
      socket.to(body.roomId).emit('receiveMessage', {
        senderId: body.senderId,
        payload: body.payload,
        action: body.action,
      });
      return;
    }
    const receiverSocketId = this.presence.getUserSocketId(body.receiverId);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('receiveMessage', {
        senderId: body.senderId,
        text: body.text,
        private: true,
      });
    } else {
      socket.emit('errorMessage', 'User not found or offline.');
    }
  }

  sendNotification(userId: string, notificationData: any) {
    const userSocketId = this.presence.getUserSocketId(userId);
    if (userSocketId) {
      this.server.to(userSocketId).emit('notification', notificationData);
    } else {
      console.log(`User ${userId} is offline.`);
    }
  }
}
