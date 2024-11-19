const MarketingLog = require("../../models/MarketingModel");
const { calculateSalesAnalytics } = require("../../services/marketingService");

exports.resetMarketLogs = async () => {
  try {
    const marketLogs = await MarketingLog.find();
    if (marketLogs.length === 0) {
      return;
    }
    marketLogs.map(async (log) => {
      //1- create a sales analytics object for the current month
      log.salesAnalytics = await calculateSalesAnalytics(
        log.sales,
        log.totalSalesMoney
      );
      log.totalSalesMoney = 0;
      log.sales = [];
      log.percentage = log.role === "head" ? 20 : 10;
      await log.save();
    });
    return true;
  } catch (err) {
    console.log(err.message);
    throw err;
  }
};
