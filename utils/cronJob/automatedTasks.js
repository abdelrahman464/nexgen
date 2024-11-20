const cron = require("node-cron");
const MarketingLog = require("../../models/MarketingModel");
const {
  createProfitsInvoice,
  createCommissionInvoice,
} = require("../../services/marketingInvoicesService");
const { calculateSalesAnalytics } = require("../../services/marketingService");

exports.invoicesCronJob = () => {
  cron.schedule("* * * * *", () => {
    console.log("running a task every minute");
    this.resetMarketLogs();
  });
};

exports.resetMarketLogs = async () => {
  try {
    const marketLogs = await MarketingLog.find();
    if (marketLogs.length === 0) {
      return;
    }
    marketLogs.map(async (log) => {
      //1- create a sales analytics object for the current month
      const salesAnalytics = await calculateSalesAnalytics(
        log.sales,
        log.totalSalesMoney
      );
      if (salesAnalytics.analytics.length !== 0)
        log.salesAnalytics.push(salesAnalytics);
      //2- create any invoices remaining for the current month
      log = await createProfitsInvoice(log);
      //3- create any commissions remaining for the current month
      log = await createCommissionInvoice(log);
      //4- reset the sales array and total sales
      log.totalSalesMoney = 0;
      log.profits = 0;
      log.sales = [];
      log.commissions = [];
      log.profitPercentage = log.role === "head" ? 20 : 10;
      await log.save();
    });
    return true;
  } catch (err) {
    console.log(err.message);
    throw err;
  }
};
