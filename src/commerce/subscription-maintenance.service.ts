import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class SubscriptionMaintenanceService {
  constructor(
    @InjectModel('UserSubscription') private readonly subscriptionModel: Model<any>,
    @InjectModel('Chat') private readonly chatModel: Model<any>,
    @InjectModel('Notification') private readonly notificationModel: Model<any>,
  ) {}

  @Cron('0 * * * *')
  async kickUnsubscribedUsersCron() {
    console.log('Running kickUnsubscribedUsers cron job...');
    const result = await this.kickUnsubscribedUsersJob();
    console.log('Cron job finished:', result);
    return result;
  }

  async kickUnsubscribedUsersJob(now = new Date()) {
    const expiredSubscriptions = await this.subscriptionModel
      .find({ endDate: { $lt: now } })
      .sort({ endDate: -1 })
      .populate({ path: 'user', select: 'invitor email' });

    let processedCount = 0;

    for (const subscription of expiredSubscriptions) {
      try {
        if (!subscription.user?._id) {
          console.log(`No user found for subscription ${subscription._id}`);
          continue;
        }
        if (!subscription.package?.course?._id) {
          console.log(`No course found for subscription ${subscription._id}`);
          continue;
        }

        const queryConditions: Record<string, any>[] = [{ course: subscription.package.course._id }];
        if (subscription.user?.invitor) queryConditions.push({ creator: subscription.user.invitor });

        const chats = await this.chatModel.find({
          $or: queryConditions,
          'participants.user': subscription.user._id,
        });

        for (const chat of chats) {
          const participant = chat.participants?.find((item: any) => this.idString(item.user) === this.idString(subscription.user._id));
          if (!participant || participant.isAdmin) {
            console.log(`Skipped admin user ${subscription.user._id} from chat ${chat._id}`);
            continue;
          }

          const result = await this.chatModel.updateOne(
            { _id: chat._id },
            { $pull: { participants: { user: subscription.user._id } } },
          );
          if ((result as any).modifiedCount > 0) {
            await this.notificationModel.create({
              user: subscription.user._id,
              message: {
                en: `You have been removed from the group ${chat.groupName}`,
                ar: `ØªÙ…Øª Ø§Ø²Ø§Ù„ØªÙƒ Ù…Ù† Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø© ${chat.groupName}`,
              },
              type: 'system',
            });
            processedCount += 1;
            console.log(`Removed user ${subscription.user._id} from chat ${chat._id}`);
          }
        }
      } catch (error) {
        console.error(`Error processing subscription ${subscription._id}:`, error);
      }
    }

    console.log('Cron job completed. Processed:', processedCount);
    return { success: true, processedCount };
  }

  private idString(value: any) {
    return (value?._id || value)?.toString();
  }
}
