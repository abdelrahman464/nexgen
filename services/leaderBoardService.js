const MarketingLog = require("../models/MarketingModel");
const { wrapUserImageWithServer } = require("../helpers/generalHelper");

exports.getTopSellersFromMarketLog = async (req, res) => {
  // Get top 3 sellers based on totalSalesMoney
  let topSellers = await MarketingLog.find({
    role: { $in: ["marketer", "head"] }, // Only get marketers and heads
    totalSalesMoney: { $gt: 0 }, // Only those with sales
  })
    .sort({ totalSalesMoney: -1 })
    .limit(3)
    .populate({
      path: "marketer",
      select: "name email profileImg",
    })
    .lean();

  if (!topSellers || topSellers.length === 0) {
    return res.status(404).json({ message: "No Top Sellers Found" });
  }

   topSellers = topSellers.map((seller) => ({
    ...seller,
    marketer: {
      ...seller.marketer,
      profileImg: wrapUserImageWithServer(seller.marketer.profileImg),
    },
  }));
  // Format the response to match leaderBoard structure
  const formattedLeaderBoard = {
    firstRank: topSellers[0]
      ? {
          amount: topSellers[0].totalSalesMoney,
          marketer: topSellers[0].marketer,
        }
      : { amount: 0 },
    secondRank: topSellers[1]
      ? {
          amount: topSellers[1].totalSalesMoney,
          marketer: topSellers[1].marketer,
        }
      : { amount: 0 },
    thirdRank: topSellers[2]
      ? {
          amount: topSellers[2].totalSalesMoney,
          marketer: topSellers[2].marketer,
        }
      : { amount: 0 },
  };

  return res.status(200).json({
    status: "success",
    leaderBoard: formattedLeaderBoard,
  });
};
