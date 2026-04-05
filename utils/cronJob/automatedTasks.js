const cron = require("node-cron");
const MarketingLog = require("../../models/MarketingModel");
const {
  createProfitsInvoice,
  createCommissionInvoice,
} = require("../../services/marketing/marketingInvoicesService");
const Order = require("../../models/orderModel");
const { kickUnsubscribedUsersJob } = require("../migrationScripts");
const {
  sendSubscriptionRenewalEmails,
} = require("../../services/packageService");

exports.cronJobs = () => {
  cron.schedule("0 0 0 1 * *", () => {
    console.log(
      "calculating monthly invoices for marketers at the first second of each month"
    );
    this.resetMarketLogs();
  });
  cron.schedule("0 * * * *", async () => {
    console.log("Running kickUnsubscribedUsers cron job...");
    const result = await kickUnsubscribedUsersJob();
    console.log("Cron job finished:", result);
  });
  // Every day at 9:00 AM — remind users whose subscription expires within 3 days
  cron.schedule("0 9 * * *", async () => {
    console.log("Running subscription renewal reminder emails...");
    try {
      const result = await sendSubscriptionRenewalEmails(3);
      console.log("Renewal reminder cron finished:", result);
    } catch (err) {
      console.error("Renewal reminder cron error:", err.message);
    }
  });
};

exports.resetMarketLogs = async () => {
  try {
    const marketLogs = await MarketingLog.find({
      $or: [
        { totalSalesMoney: { $gt: 0 } },
        { sales: { $exists: true, $not: { $size: 0 } } },
        { commissions: { $exists: true, $not: { $size: 0 } } },
      ],
    });
    if (marketLogs.length === 0) {
      console.log("no market logs found");
      return;
    }
    const headsMarketLogs = [];
    const marketersMarketLogs = [];

    marketLogs.map((log) => {
      if (log.role === "head") {
        headsMarketLogs.push(log);
      } else {
        marketersMarketLogs.push(log);
      }
    });
    //calculate them first cause if they require any data from their team
    headsMarketLogs.map(async (log) => {
      //2- create any invoices remaining for the current month
      log = await createProfitsInvoice(log);
      //3- create any commissions remaining for the current month
      log = await createCommissionInvoice(log);
      //4- reset the sales array and total sales
      log.totalSalesMoney = 0;
      log.profits = 0;
      log.sales = [];
      log.commissions = [];
      log.withdrawals = 0;
      const defaultProfitPercentage = log.role === "head" ? 20 : 10;
      if (
        !log.profitsCalculationMethod ||
        log.profitsCalculationMethod !== "manual"
      ) {
        log.profitPercentage = defaultProfitPercentage;
      }
      await log.save();
    });

    marketersMarketLogs.map(async (log) => {
      //2- create any invoices remaining for the current month
      log = await createProfitsInvoice(log);
      //3- create any commissions remaining for the current month
      log = await createCommissionInvoice(log);
      //4- update orders with marketer percentage
      let ordersIds = [];
      ordersIds = log.sales?.map((sale) => sale.order);
      await setMarketerPercentageToOrders(log.profitPercentage, ordersIds);
      //5- reset the sales array and total sales
      log.totalSalesMoney = 0;
      log.profits = 0;
      log.sales = [];
      log.commissions = [];
      log.withdrawals = 0;
      if (
        !log.profitsCalculationMethod ||
        log.profitsCalculationMethod !== "manual"
      ) {
        log.profitPercentage = defaultProfitPercentage;
      }
      await log.save();
    });

    return true;
  } catch (err) {
    console.log(err.message);
    throw err;
  }
};
const setMarketerPercentageToOrders = async (marketerPercentage, ordersIds) => {
  if (ordersIds.length === 0) return;
  try {
    await Order.updateMany(
      { _id: { $in: ordersIds } },
      { $set: { marketerPercentage } }
    );
  } catch (err) {
    console.log(err.message);
    throw err;
  }
};
