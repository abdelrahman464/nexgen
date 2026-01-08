const { calculateProfits } = require("../services/marketing/marketingService");
const {
  giveInstructorHisCommission,
} = require("../services/marketing/instructorProfitsService");

const MarketingLog = require("../models/MarketingModel");
const Course = require("../models/courseModel");





const getProfitableItem =  (marketer, itemId, itemType) => {
  if(!marketer) return null;
  const profitableItem =  marketer.profitableItems.find(
    (i) => i.itemId.toString() === itemId.toString() && i.itemType === itemType
  );
  return profitableItem;
};



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
  let sellerPercentage = 0;
  let totalMarketingProfits = 0;
  let headMarketerPercentage = 0;
  if (data.invitor) {
    const marketer = await MarketingLog.findOne({ marketer: data.invitor });
    const profitableItem = getProfitableItem(marketer, item._id, data.itemType);
    if (profitableItem) {
      sellerPercentage = profitableItem.percentage;
      data.marketerPercentage = sellerPercentage;
      const head = await MarketingLog.findOne({ marketer: marketer.invitor });
      const headProfitableItem = getProfitableItem(head, item._id, data.itemType);
      if (headProfitableItem) {
        headMarketerPercentage = headProfitableItem.percentage;
        data.headMarketerPercentage = headMarketerPercentage;
      }
    }
   }
  if (item.instructorPercentage) {
    data.instructorPercentage = item.instructorPercentage;
    data.instructorId = item.instructor;
    const instructorProfit = (data.amount * data.instructorPercentage) / 100;
    data.totalProfits = instructorProfit;
    if (headMarketerPercentage > 0 || sellerPercentage > 0) {
      totalMarketingProfits = (instructorProfit * (headMarketerPercentage || sellerPercentage)) / 100;
      data.netInstructorProfit = instructorProfit - totalMarketingProfits;
      data.totalMarketingProfits = totalMarketingProfits;
    }
    data.instructorProfits = data.netInstructorProfit;
    await giveInstructorHisCommission(data);
  }
  //call `calculateProfits` and send data to it
  if (sellerPercentage > 0) {
    data.sellerProfits = (data.totalProfits * sellerPercentage) / 100;
    const netHeadMarketerPercentage = headMarketerPercentage - sellerPercentage;
    data.headMarketerPercentage = netHeadMarketerPercentage;
    data.headMarketerProfits = (data.totalProfits * netHeadMarketerPercentage) / 100;
    await calculateProfits(data);
  }
};

// exports.handleCoursePackageOrderCommissions = async (item, data) => {
//   //if item.instructorPercentage
//   //call `appendNewSale` from instructorProfitsService that push new commission and update totalSales
//   item.profitableCourses.map(async (item) => {
//     const course = await Course.findOne({ _id: item.course });
//     if(!course){
//       break:
//     }
//     let marketerPercentage = 0;
//     let marketerProfits = 0;
//     if (data.invitor) {
//       const marketer = await MarketingLog.findOne({ marketer: data.invitor });
//       if (marketer) {
//         const profitableItem = marketer.profitableItems.find(
//           (i) =>
//             i.itemId.toString() === course._id.toString()
//         );
//         if (profitableItem) {
//           marketerPercentage = profitableItem.percentage;
//         }
//       }
//     }

//     data.instructorPercentage = item.instructorPercentage;
//     data.instructorId = course.instructor._id;
//     let instructorProfit = item.instructorProfits
//     if (marketerPercentage > 0) {
//       marketerProfits = (instructorProfit * marketerPercentage) / 100;
//       instructorProfit -= marketerProfits;
//     }
//     data.instructorProfits = instructorProfit;
//     await giveInstructorHisCommission(data, instructorProfit);

//     //call `calculateProfits` and send data to it
//     if (marketerPercentage > 0) {
//       data.marketerPercentage = marketerPercentage;
//       data.marketerProfits =
//         marketerProfits !== 0
//           ? marketerProfits // that's mean his profit already calculated from instructor profit
//           : (course.price * marketerPercentage) / 100;

//       await calculateProfits(data);
//     }
//   });
// };
