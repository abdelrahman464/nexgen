const LeaderBoard = require("../models/leaderBoardModel");

exports.addMarketerToLeaderBoard = async (data) => {
  const { currentMonth, currentYear, marketerId, totalSalesMoney } = data;
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
// const reformLeaderBoard = async (leaderBoard, marketerId, totalSalesMoney) => {
//   const { firstRank, secondRank, thirdRank } = leaderBoard;

//   // Determine the current rank of the marketer if already present
//   let currentRank;
//   if (firstRank?.marketer?.toString() === marketerId.toString())
//     currentRank = "firstRank";
//   else if (secondRank?.marketer?.toString() === marketerId.toString())
//     currentRank = "secondRank";
//   else if (thirdRank?.marketer?.toString() === marketerId.toString())
//     currentRank = "thirdRank";
//   else currentRank = "newEntry";

//   // Use switch-case to handle each rank scenario
//   switch (currentRank) {
//     case "firstRank":
//       // Update first rank if new amount is higher
//       if (totalSalesMoney > firstRank.amount) {
//         leaderBoard.firstRank.amount = totalSalesMoney;
//         leaderBoard.firstRank.gotInAt = Date.now();
//       }
//       break;

//     case "secondRank":
//       // Promote to first rank if amount is higher than first rank
//       if (totalSalesMoney > firstRank.amount) {
//         leaderBoard.thirdRank = secondRank;
//         leaderBoard.secondRank = firstRank;
//         leaderBoard.firstRank = {
//           amount: totalSalesMoney,
//           marketer: marketerId,
//           gotInAt: Date.now(),
//         };
//       } else if (totalSalesMoney > secondRank.amount) {
//         leaderBoard.secondRank.amount = totalSalesMoney;
//         leaderBoard.secondRank.gotInAt = Date.now();
//       }
//       break;

//     case "thirdRank":
//       // Promote to higher rank if applicable
//       if (totalSalesMoney > firstRank.amount) {
//         leaderBoard.thirdRank = secondRank;
//         leaderBoard.secondRank = firstRank;
//         leaderBoard.firstRank = {
//           amount: totalSalesMoney,
//           marketer: marketerId,
//           gotInAt: Date.now(),
//         };
//       } else if (totalSalesMoney > secondRank.amount) {
//         leaderBoard.thirdRank = secondRank;
//         leaderBoard.secondRank = {
//           amount: totalSalesMoney,
//           marketer: marketerId,
//           gotInAt: Date.now(),
//         };
//       } else if (totalSalesMoney > thirdRank.amount) {
//         leaderBoard.thirdRank.amount = totalSalesMoney;
//         leaderBoard.thirdRank.gotInAt = Date.now();
//       }
//       break;

//     case "newEntry":
//       // If marketer doesn't exist in ranks, evaluate for entry
//       if (totalSalesMoney > firstRank.amount) {
//         leaderBoard.thirdRank = secondRank;
//         leaderBoard.secondRank = firstRank;
//         leaderBoard.firstRank = {
//           amount: totalSalesMoney,
//           marketer: marketerId,
//           gotInAt: Date.now(),
//         };
//       } else if (!secondRank || totalSalesMoney > secondRank.amount) {
//         leaderBoard.thirdRank = secondRank;
//         leaderBoard.secondRank = {
//           amount: totalSalesMoney,
//           marketer: marketerId,
//           gotInAt: Date.now(),
//         };
//       } else if (!thirdRank || totalSalesMoney > thirdRank.amount) {
//         leaderBoard.thirdRank = {
//           amount: totalSalesMoney,
//           marketer: marketerId,
//           gotInAt: Date.now(),
//         };
//       }
//       break;

//     default:
//       throw new Error("Unexpected rank");
//   }

//   return leaderBoard;
// };
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
