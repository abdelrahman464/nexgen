const MarketingLog = require("../models/MarketingModel");
const {
  getInstructorProfitsInvoices,
  updateInstructorProfitsInvoiceStatus,
} = require("./instructorProfitsService");
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
/*
//---------------------------------------------------------------------------------------------------//
// Create a new WithdrawRequest
//@params "month" of the invoice
exports.requestInvoice = async (req, res, next) => {
  try {
    const { invoiceId, recieverAcc, paymentMethod } = req.body;

    // Find the marketing log containing the invoice
    const marketingLog = await MarketingLog.findOne({
      "invoices._id": invoiceId,
    });

    if (!marketingLog) {
      return res
        .status(200)
        .json({ status: `failed`, msg: "You don't work as a marketer" });
    }

    // Find the specific invoice within the marketing log
    const invoice = marketingLog.invoices.id(invoiceId);

    if (!invoice) {
      return res
        .status(404)
        .json({ status: `failed`, msg: "Invoice not found" });
    }

    // Check if the invoice is already pending
    if (invoice.status === "pending") {
      return res.status(400).json({
        status: `failed`,
        msg: "You have requested this invoice to be paid before",
      });
    }

    // Update invoice fields
    invoice.status = "pending";
    invoice.recieverAcc = recieverAcc;
    invoice.paymentMethod = paymentMethod;

    await marketingLog.save();

    return res.status(200).json({
      status: `success`,
      msg: "You have requested this invoice to be paid successfully",
    });
  } catch (error) {
    return next(error); // Pass errors to the error handling middleware
  }
};
*/
