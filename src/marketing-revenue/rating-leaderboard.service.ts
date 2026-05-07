import { NotFoundException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiQueryHelper } from '../common/pagination/api-query.helper';
import { CreateMarketerRatingDto } from './dto/marketing-revenue.dto';

const { wrapUserImageWithServer } = require('../../helpers/generalHelper');

@Injectable()
export class RatingLeaderboardService {
  constructor(
    @InjectModel('MarketerRating') private readonly ratingModel: Model<any>,
    @InjectModel('MarketingLogs') private readonly marketingLogModel: Model<any>,
  ) {}

  async getRatings(query: Record<string, any>) {
    if (query.marketer) {
      const data = await this.ratingModel.find({ marketer: query.marketer });
      return { status: 'success', data };
    }
    const data = await this.ratingModel.aggregate([{ $group: { _id: '$marketer', ratings: { $push: '$$ROOT' } } }]);
    return { status: 'success', data };
  }

  async getRating(id: string) {
    const data = await this.ratingModel.findById(id);
    if (!data) throw new NotFoundException(`No document for this id ${id}`);
    return { data };
  }

  async createRating(body: CreateMarketerRatingDto, user: any) {
    return { data: await this.ratingModel.create({ ...body, rater: user._id }) };
  }

  async deleteRating(id: string) {
    const document = await this.ratingModel.findByIdAndDelete(id);
    if (!document) throw new NotFoundException(`No document for this id ${id}`);
    return undefined;
  }

  async getLeaderBoard() {
    let topSellers = await this.marketingLogModel
      .find({ role: { $in: ['marketer', 'head'] }, totalSalesMoney: { $gt: 0 } })
      .sort({ totalSalesMoney: -1 })
      .limit(3)
      .populate({ path: 'marketer', select: 'name email profileImg' })
      .lean();
    if (!topSellers?.length) throw new NotFoundException('No Top Sellers Found');
    topSellers = topSellers.map((seller: any) => ({
      ...seller,
      marketer: { ...seller.marketer, profileImg: wrapUserImageWithServer(seller.marketer?.profileImg) },
    }));
    const leaderBoard = {
      firstRank: topSellers[0] ? { amount: topSellers[0].totalSalesMoney, marketer: topSellers[0].marketer } : { amount: 0 },
      secondRank: topSellers[1] ? { amount: topSellers[1].totalSalesMoney, marketer: topSellers[1].marketer } : { amount: 0 },
      thirdRank: topSellers[2] ? { amount: topSellers[2].totalSalesMoney, marketer: topSellers[2].marketer } : { amount: 0 },
    };
    return { status: 'success', leaderBoard };
  }
}
