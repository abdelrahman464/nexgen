const cron = require("node-cron");
const MarketingLog = require("../../models/MarketingModel");
const {
  createProfitsInvoice,
  createCommissionInvoice,
} = require("../../services/marketing/marketingInvoicesService");

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
