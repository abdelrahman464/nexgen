const { calculateProfits } = require("../services/marketing/marketingService");
const {
  giveInstructorHisCommission,
} = require("../services/marketing/instructorProfitsService");

const MarketingLog = require("../models/MarketingModel");

//---------------------------------------------------
//Buisness Logic

// if the sold item (course | package | coursePackage) has instructorPercentage field
// tha't means this item has instructor commission

// then we will check if purchaser has invitor (marketer) or not
// if has invitor (marketer) we will check if this marketer has this item in his profitableItems array
// if has we will get the percentage from there
// then we will calculate instructor profit after deducting marketer profit from it

//--------------
/**
 *
 * @param {*} item
 * @param {*} data
 */
exports.handleOrderCommissions = async (item, data) => {
  //if item.instructorPercentage
  //call `appendNewSale` from instructorProfitsService that push new commission and update totalSales
  let marketerPercentage = 0;
  let marketerProfits = 0;
  if (data.invitor) {
    const marketer = await MarketingLog.findOne({ marketer: data.invitor });
    if (marketer) {
      const profitableItem = marketer.profitableItems.find(
        (i) =>
          i.itemId.toString() === item._id.toString() &&
          i.itemType === data.itemType
      );
      if (profitableItem) {
        marketerPercentage = profitableItem.percentage;
      }
    }
  }

  if (item.instructorPercentage) {
    data.instructorPercentage = item.instructorPercentage;
    data.instructorId = item.instructor;
    let instructorProfit = (data.amount * data.instructorPercentage) / 100;
    if (marketerPercentage > 0) {
      marketerProfits = (instructorProfit * marketerPercentage) / 100;
      instructorProfit -= marketerProfits;
    }
    data.instructorProfits = instructorProfit;
    await giveInstructorHisCommission(data, instructorProfit);
  }
  //call `calculateProfits` and send data to it
  if (marketerPercentage > 0) {
    data.marketerPercentage = marketerPercentage;
    data.marketerProfits =
      marketerProfits !== 0
        ? marketerProfits // that's mean his profit already calculated from instructor profit
        : (data.amount * marketerPercentage) / 100;

    await calculateProfits(data);
  }
};
