const LeaderBoard = require("../models/leaderBoardModel");

exports.addMarketerToLeaderBoard = async (marketerId, totalSalesMoney) => {
  totalSalesMoney = 1400;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Find or create leaderboard document
  let leaderBoardDoc = await LeaderBoard.findOne({
    year: currentYear,
    month: currentMonth,
  });

  if (!leaderBoardDoc) {
    return await LeaderBoard.create({
      year: currentYear,
      month: currentMonth,
      firstRank: {
        amount: totalSalesMoney,
        marketer: marketerId,
        gotInAt: new Date(),
      },
      secondRank: { amount: 0 },
      thirdRank: { amount: 0 },
    });
  }
  // Create a deep copy of current ranks to avoid reference issues
  const currentRanks = {
    firstRank: leaderBoardDoc.firstRank?.marketer
      ? { ...leaderBoardDoc.firstRank.toObject() }
      : { amount: 0 },
    secondRank: leaderBoardDoc.secondRank?.marketer
      ? { ...leaderBoardDoc.secondRank.toObject() }
      : { amount: 0 },
    thirdRank: leaderBoardDoc.thirdRank?.marketer
      ? { ...leaderBoardDoc.thirdRank.toObject() }
      : { amount: 0 },
  };

  // Check if marketer exists in any rank and update amount
  const ranks = ["firstRank", "secondRank", "thirdRank"];
  let marketerFound = false;

  for (const rank of ranks) {
    if (
      currentRanks[rank]?.marketer?._id.toString() === marketerId.toString()
    ) {
      currentRanks[rank].amount = totalSalesMoney;
      marketerFound = true;
      break;
    }
  }
  // If marketer not found in any rank, add them to appropriate position
  // Prepare all entries including the new marketer if not found
  const allEntries = [
    currentRanks.firstRank,
    currentRanks.secondRank,
    currentRanks.thirdRank,
    ...(!marketerFound
      ? [
          {
            amount: totalSalesMoney,
            marketer: marketerId,
            gotInAt: new Date(),
          },
        ]
      : []),
  ].filter((entry) => entry?.marketer); // Remove empty ranks

  allEntries.sort((a, b) => b.amount - a.amount);

  //till here
  leaderBoardDoc.firstRank = allEntries[0]
    ? { ...allEntries[0] }
    : { amount: 0 };
  leaderBoardDoc.secondRank = allEntries[1]
    ? { ...allEntries[1] }
    : { amount: 0 };
  leaderBoardDoc.thirdRank = allEntries[2]
    ? { ...allEntries[2] }
    : { amount: 0 };
  // Save the updated document
  await leaderBoardDoc.save();

  return true;
};
//---------------------------------------------------
exports.getLeaderBoard = async (req, res) => {
  const filter = {};
  const { year, month } = req.query;
  filter.year = year ? year : new Date().getFullYear();
  filter.month = month ? month : new Date().getMonth() + 1;
  const leaderBoard = await LeaderBoard.findOne(filter).lean();
  if (!leaderBoard)
    return res.status(404).json({ message: "No Leader Board Found" });

  return res.status(200).json({ status: `success`, leaderBoard });
};
