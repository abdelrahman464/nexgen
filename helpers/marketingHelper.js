const { calculateProfits } = require("../services/marketing/marketingService");
const {
  giveInstructorHisCommission,
} = require("../services/instructorProfitsService");

exports.handleOrderCommissions = async (item, data) => {
  //if item.instructorPercentage
  //call `appendNewSale` from instructorProfitsService that push new commission and update totalSales
  if (item.instructorPercentage) {
    data.instructorPercentage = item.instructorPercentage;
    data.instructorId = item.instructor;
    await giveInstructorHisCommission(data);
    data.amount = (data.amount * data.instructorPercentage) / 100;
  }
  //call `calculateProfits` and send data to it
  await calculateProfits(data);
};
