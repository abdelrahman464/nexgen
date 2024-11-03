const LeaderBoard = require("../models/leaderBoardModel");

exports.addMarketerToLeaderBoard = async (
  marketerId,
  totalSalesMoney,
  year,
  month
) => {
  let leaderBoard = await LeaderBoard.findOne({ year, month });
  if (!leaderBoard) {
    await LeaderBoard.create({
      year,
      month,
      firstRank: [
        {
          marketer: marketerId,
          totalSalesMoney,
        },
      ],
      secondRank: [],
      thirdRank: [],
    });
  } else {
    leaderBoard = await reformLeaderBoard(
      leaderBoard,
      marketerId,
      totalSalesMoney
    );
    await LeaderBoard.save();
  }
  return true;
};
//---------------------------------------------------
const reformLeaderBoard = async (leaderBoard, marketerId, totalSalesMoney) => {
  if (
    !leaderBoard.firstRank ||
    leaderBoard.firstRank.amount === totalSalesMoney
  ) {
    leaderBoard.firstRank.amount = totalSalesMoney;
    leaderBoard.firstRank.members.push(marketerId);
  } else if (leaderBoard.firstRank.amount < totalSalesMoney) {
    //get the old amount and members
    const previousFirstRankAmount = leaderBoard.firstRank.amount;
    const previousFirstRankMembers = leaderBoard.firstRank.members;
    //update the first rank
    leaderBoard.firstRank.amount = totalSalesMoney;
    leaderBoard.firstRank.members = [marketerId];
    //move old members to lower level
    leaderBoard = moveMembersToSecondRank(
      leaderBoard,
      previousFirstRankMembers,
      previousFirstRankAmount
    );
  } //check on second rank
  else if (
    !leaderBoard.secondRank ||
    leaderBoard.secondRank.amount === totalSalesMoney
  ) {
    leaderBoard.firstRank.members.push(marketerId);
  } else if (leaderBoard.secondRank.amount < totalSalesMoney) {
    //get the old amount and members
    const previousSecondRankAmount = leaderBoard.secondRank.amount;
    const previousSecondRankMembers = leaderBoard.secondRank.members;
    //update the first rank
    leaderBoard.secondRank.amount = totalSalesMoney;
    leaderBoard.secondRank.members = [marketerId];
    //move old members to lower level
    leaderBoard = moveMembersToThirdRank(
      leaderBoard,
      previousSecondRankMembers,
      previousSecondRankAmount
    );
  } else if (
    !leaderBoard.thirdRank ||
    leaderBoard.thirdRank.amount === totalSalesMoney
  ) {
    leaderBoard.thirdRank.members.push(marketerId);
  } else if (leaderBoard.thirdRank.amount < totalSalesMoney) {
    leaderBoard.thirdRank.amount = totalSalesMoney;
    leaderBoard.thirdRank.members = [marketerId];
  }
  return leaderBoard;
};
//----------------------------------------------------------------------
const moveMembersToSecondRank = (
  leaderBoard,
  previousFirstRankMembers,
  previousFirstRankAmount
) => {
  if (!leaderBoard.secondRank) {
    leaderBoard.secondRank = {
      amount: previousFirstRankAmount,
      members: previousFirstRankMembers,
    };
  } else if (leaderBoard.secondRank.amount === previousFirstRankAmount) {
    leaderBoard.secondRank.members = leaderBoard.secondRank.members.concat(
      previousFirstRankMembers
    );
  } else if (leaderBoard.secondRank.amount < previousFirstRankAmount) {
    //get the old amount and members
    const previousSecondRankAmount = leaderBoard.secondRank.amount;
    const previousSecondRankMembers = leaderBoard.secondRank.members;
    //update the second rank
    leaderBoard.secondRank.amount = previousFirstRankAmount;
    leaderBoard.secondRank.members = previousFirstRankMembers;
    leaderBoard = moveMembersToThirdRank(
      leaderBoard,
      previousSecondRankMembers,
      previousSecondRankAmount
    );
  }

  return leaderBoard;
};

const moveMembersToThirdRank = (
  leaderBoard,
  previousSecondRankMembers,
  previousSecondRankAmount
) => {
  if (!leaderBoard.thirdRank) {
    leaderBoard.thirdRank = {
      amount: previousSecondRankAmount,
      members: previousSecondRankMembers,
    };
  } else if (leaderBoard.thirdRank.amount === previousSecondRankAmount) {
    leaderBoard.thirdRank.members = leaderBoard.thirdRank.members.concat(
      previousSecondRankMembers
    );
  } else if (leaderBoard.thirdRank.amount < previousSecondRankAmount) {
    //just replace the third rank
    leaderBoard.thirdRank.amount = previousSecondRankAmount;
    leaderBoard.thirdRank.members = previousSecondRankMembers;
  }

  return leaderBoard;
};

//---------------------------------------------------
exports.getLeaderBoard = async (req) => {
//   const leaderBoard = await LeaderBoard.findOne({ year, month });
//   return leaderBoard;
};
//---------------------------------------------------
