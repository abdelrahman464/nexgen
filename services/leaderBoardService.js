const LeaderBoard = require("../models/leaderBoardModel");

exports.addMarketerToLeaderBoard = async (marketerId, totalSalesMoney) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  let leaderBoardDoc = await LeaderBoard.findOne({
    year: currentYear,
    month: currentMonth,
  }).lean(); // lean() to get plain JS object instead of Mongoose document
  if (!leaderBoardDoc) {
    await LeaderBoard.create({
      year: currentYear,
      month: currentMonth,
      firstRank: {
        amount: totalSalesMoney,
        marketer: marketerId,
        gotInAt: Date.now(),
      },
      secondRank: {},
      thirdRank: {},
    });
    return true;
  }
  //check if the marketer is already in the leader board
  if (
    leaderBoardDoc.firstRank &&
    leaderBoardDoc.firstRank.marketer.toString() === marketerId.toString()
  ) {
    leaderBoardDoc.firstRank.amount = totalSalesMoney;
  } else if (
    leaderBoardDoc?.secondRank?.marketer?.toString() === marketerId.toString()
  ) {
    leaderBoardDoc.secondRank.amount = totalSalesMoney;
    leaderBoardDoc = secondRank(leaderBoardDoc);
  } else if (
    leaderBoardDoc?.thirdRank?.marketer?.toString() === marketerId.toString()
  ) {
    leaderBoardDoc.thirdRank.amount = totalSalesMoney;
    leaderBoardDoc = thirdRank(leaderBoardDoc);
  }
  //if the marketer is not in the leader board
  else {
    leaderBoardDoc = await reformLeaderBoard(
      leaderBoardDoc,
      marketerId,
      totalSalesMoney
    );
  }
  //update the leader board
  await LeaderBoard.findByIdAndUpdate(leaderBoardDoc._id, leaderBoardDoc);

  return true;
};
//---------------------------------------------------
const reformLeaderBoard = async (leaderBoard, marketerId, totalSalesMoney) => {
  if (totalSalesMoney > leaderBoard.firstRank.amount) {
    leaderBoard.thirdRank = leaderBoard.secondRank;
    leaderBoard.secondRank = leaderBoard.firstRank;
    leaderBoard.firstRank = {
      amount: totalSalesMoney,
      marketer: marketerId,
      gotInAt: Date.now(),
    };
  } else if (!leaderBoard.secondRank) {
    leaderBoard.secondRank = {
      amount: totalSalesMoney,
      marketer: marketerId,
      gotInAt: Date.now(),
    };
  } else if (totalSalesMoney > leaderBoard.secondRank.amount) {
    leaderBoard.thirdRank = leaderBoard.secondRank;
    leaderBoard.secondRank = {
      amount: totalSalesMoney,
      marketer: marketerId,
      gotInAt: Date.now(),
    };
  } else if (!leaderBoard.thirdRank) {
    leaderBoard.thirdRank = {
      amount: totalSalesMoney,
      marketer: marketerId,
      gotInAt: Date.now(),
    };
  } else if (totalSalesMoney > leaderBoard.thirdRank.amount) {
    leaderBoard.thirdRank = {
      amount: totalSalesMoney,
      marketer: marketerId,
      gotInAt: Date.now(),
    };
  }
  return leaderBoard;
};
//---------------------------------------------------
const secondRank = (leaderBoard) => {
  if (leaderBoard.secondRank.amount > leaderBoard.firstRank.amount) {
    //swap the two ranks
    const temp = leaderBoard.firstRank;
    leaderBoard.firstRank = leaderBoard.secondRank;
    leaderBoard.secondRank = temp;
  }
  return leaderBoard;
};
//---------------------------------------------------
const thirdRank = (leaderBoard) => {
  if (leaderBoard.thirdRank.amount > leaderBoard.firstRank.amount) {
    const temp = leaderBoard.firstRank;
    leaderBoard.firstRank = leaderBoard.thirdRank;
    leaderBoard.thirdRank = temp;
  }
  //thirdRank may be the original , or the firstRank after the above swap
  if (leaderBoard.thirdRank.amount > leaderBoard.secondRank.amount) {
    const temp = leaderBoard.secondRank;
    leaderBoard.secondRank = leaderBoard.thirdRank;
    leaderBoard.thirdRank = temp;
  }
  return leaderBoard;
};
//---------------------------------------------------
exports.getLeaderBoard = async (req, res) => {
  const filter = {};
  const { year, month } = req.query;
  filter.year = year ? year : new Date().getFullYear();
  filter.month = month ? month : new Date().getMonth() + 1;
  const leaderBoard = await LeaderBoard.findOne(filter);
  if (!leaderBoard)
    return res.status(404).json({ message: "No Leader Board Found" });
  return res.status(200).json({ status: `success`, leaderBoard });
};
