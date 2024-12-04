const MarketingLog = require("../../models/MarketingModel");
const {
  getInstructorProfitsInvoices,
  updateInstructorProfitsInvoiceStatus,
} = require("../instructorProfitsService");
const { getMonthMoney } = require("./marketingService");

//1
const getInvoices = async (status) => {
  try {
    const requestedInvoices = await MarketingLog.find({
      "invoices.status": status,
    }).populate("marketer", "name email profileImg");
    // return res.json(requestedInvoices);
    if (requestedInvoices.length === 0) {
      throw new Error(`No invoices with status ${status}`);
    }
    // Filter only the invoices with the specified status
    const invoices = requestedInvoices.map((log) => ({
      _id: log._id,
      role: log.role,
      marketer: log.marketer,
      invoices: log.invoices.filter((invoice) => invoice.status === status),
    }));
    //send the response
    return {
      status: "success",
      length: invoices.length,
      data: invoices,
    };
  } catch (error) {
    throw new Error(error);
  }
};
//2
const getWalletInvoices = async (status) => {
  try {
    const requestedInvoices = await MarketingLog.find({
      "walletInvoices.status": status,
    }).populate("marketer", "name email profileImg");

    if (requestedInvoices.length === 0) {
      throw new Error(`No wallet invoices with status => ${status}`);
    }
    // Filter only the invoices with the specified status
    const invoices = requestedInvoices.map((log) => ({
      _id: log._id,
      role: log.role,
      marketer: log.marketer,
      invoices: log.walletInvoices.filter(
        (walletInvoice) => walletInvoice.status === status
      ),
    }));
    //send the response
    return {
      status: "success",
      length: invoices.length,
      data: invoices,
    };
  } catch (error) {
    throw new Error(error);
  }
};
// Get all invoices (main function)
exports.getAllRequestedInvoices = async (req, res) => {
  try {
    //status => unpaid or paid or rejected
    const status = req.params.status ? req.params.status : "unpaid";
    let result;
    if (req.query.invoiceType === "wallet") {
      result = await getWalletInvoices(status);
    } else if (req.query.invoiceType === "profit") {
      result = await getInvoices(status);
    } else if (req.query.invoiceType === "instructorProfits") {
      result = await getInstructorProfitsInvoices(status);
    }
    //send the response
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ status: "error", error: `${error.message}` });
  }
};
//---------------------------------------------------------------------------------//

// Get a specific WithdrawRequest by ID
exports.getRequestedInvoice = async (req, res) => {
  const requestedInvoices = await MarketingLog.findOne({
    "invoices._id": req.params.id,
  }).select(
    "-hasSentRequest -wallet -transactions -direct_transactions -totalSalesMoney -__v -createdAt -updatedAt"
  );
  if (!requestedInvoices) {
    return res.status(404).json({ status: "faild", msg: "no invoice found" });
  }
  // Filter the invoices to only include the one with the specified ID
  const filteredInvoice = requestedInvoices.invoices.id(req.params.id);
  requestedInvoices.invoices = filteredInvoice;

  return res.status(200).json({ status: "success", data: requestedInvoices });
};
//--------------------------------------------------------------------------------------------
//1
const updateInvoiceStatus = async (id, status) => {
  //1- selecting the marketer
  const marketLog = await MarketingLog.findOne({ "invoices._id": id });
  if (!marketLog) {
    throw new Error(`No invoice found for this ${id}`);
  }
  // 4- Update the invoices in marketLog
  marketLog.invoices.forEach((invoice) => {
    //hint : invoice._id is an object not a string and id is a string , so we need to convert it to string
    if (invoice._id.toString() === id) {
      invoice.status = status;
      invoice.paidAt = status === "paid" ? new Date() : null;
    }
  });

  await marketLog.save();
};
//2
const updateWalletInvoiceStatus = async (id, status) => {
  //1- selecting the marketer
  const marketLog = await MarketingLog.findOne({ "walletInvoices._id": id });
  if (!marketLog) {
    throw new Error(`No walletInvoice found for this ${id}`);
  }
  // 4- Update the invoices in marketLog
  marketLog.invoices.forEach((invoice) => {
    //hint : invoice._id is an object not a string and id is a string , so we need to convert it to string
    if (invoice._id.toString() === id) {
      invoice.status = status;
      invoice.paidAt = status === "paid" ? new Date() : null;
    }
  });

  await marketLog.save();
};
//@params invoiceId {params}
exports.updateInvoiceStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    if (req.query.invoiceType === "wallet") {
      await updateWalletInvoiceStatus(id, status);
    } else if (req.query.invoiceType === "profit") {
      await updateInvoiceStatus(id, status);
    } else if (req.query.invoiceType === "instructorProfits") {
      await updateInstructorProfitsInvoiceStatus(id, status);
    }
    return res.status(200).json({ status: "success", msg: "invoice updated" });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ status: "error", error: `${error.message}` });
  }
};

//---------------------------------------------------------------------------------------------------//
/**
 * calculate the profits of last month and create the invoice
 * @param {Object} marketLog
 * @returns {Object} marketLog
 */
exports.createProfitsInvoice = async (marketLog) => {
  const { profitPercentage, totalSalesMoney, profits, sales } = marketLog;
  //validation -----
  //1- check if he has sales
  if (!profits || profits === 0) return marketLog;
  //2- check if he has profits to be calculated
  const result = await getMonthMoney(
    marketLog.invoices,
    new Date().getMonth() - 1 //last month , cause cron-job is running at the first day of the new month
  );

  const takenProfits = result.monthProfits;
  //3- check if he has profits to be calculated
  if (profits === takenProfits) return marketLog;

  //4-calculate the available profits
  const availableProfits = profits - takenProfits;
  //5- create the invoice
  const invoice = {
    totalSalesMoney: totalSalesMoney.toFixed(2),
    mySales: sales.length,
    profitPercentage,
    profits: availableProfits,
    desc: `final invoice for month ${new Date().getMonth()}`,
  };

  marketLog.invoices.push(invoice);
  return marketLog;
};
//function 2 ---------------------
exports.createCommissionInvoice = async (marketLog) => {
  if (marketLog.commissions?.length === 0) return marketLog;

  let profits = 0;
  //1-calculate the profits of his wallet
  profits = marketLog.commissions.reduce(
    (acc, commission) => acc + commission.profit,
    0
  );
  //4- create the invoice
  const invoice = {
    profits: profits.toFixed(2) / 2, //distribute the profits between the wallet and the commissions
    desc: `Invoice for month ${new Date().getMonth()}`,
  };
  //5- push the invoice to the walletInvoices
  marketLog.walletInvoices.push(invoice);
  marketLog.commissionsInvoices.push(invoice);

  return marketLog;
};
