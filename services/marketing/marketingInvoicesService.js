const MarketingLog = require("../../models/MarketingModel");
const {
  getInstructorProfitsInvoices,
  updateInstructorProfitsInvoiceStatus,
} = require("./instructorProfitsService");
const { getMonthMoney, getMonthBoundaries } = require("./marketingService");

//1
const getProfitsInvoices = async (status, lang = "ar") => {
  try {
    //getting marketLogs that contain invoices with the specified status
    let marketLogs = await MarketingLog.find(
      {
        "invoices.status": status,
      },
      { marketer: 1, invoices: 1, role: 1, _id: 1 }
    )
      .populate("marketer", "name email profileImg")
      .populate({
        path: "invoices.orders",
        select:
          "user course coursePackage package totalOrderPrice paymentMethodType paidAt createdAt",
      })
      .lean();

    if (marketLogs.length === 0) {
      return [];
    }
    // Filter only the invoices with the specified status
    marketLogs = marketLogs.map((log) => ({
      _id: log._id,
      role: log.role,
      marketer: log.marketer,
      invoices: log.invoices.filter((invoice) => invoice.status === status),
    }));
    // Localize titles for each order in each invoice

    //translate item's title in each order and reform each order
    marketLogs.forEach((log) => {
      log.invoices?.forEach((invoice) => {
        invoice.orderNum = invoice.orders?.length;
        if (invoice.orders && Array.isArray(invoice.orders)) {
          invoice.orders.forEach((order) => {
            // Localize course title
            if (order.course && order.course.title) {
              delete order.course.category;
              delete order.course.accessibleCourses;
              order.course = {
                ...order.course,
                title:
                  order.course.title[lang] ||
                  order.course.title.ar ||
                  order.course.title.en,
              };
            }

            // Localize package title
            if (order.package && order.package.title) {
              delete order.package.course;
              order.package = {
                ...order.package,
                title:
                  order.package.title[lang] ||
                  order.package.title.ar ||
                  order.package.title.en,
              };
            }

            // Localize coursePackage title and its courses
            if (order.coursePackage && order.coursePackage.title) {
              delete order.coursePackage.courses;
              order.coursePackage = {
                ...order.coursePackage,
                title:
                  order.coursePackage.title[lang] ||
                  order.coursePackage.title.ar ||
                  order.coursePackage.title.en,
              };
            }
          });
        }
      });
    });

    const invoicesNumber = marketLogs.reduce(
      (acc, log) => acc + log.invoices.length,
      0
    );
    //send the response
    return {
      status: "success",
      length: invoicesNumber,
      data: marketLogs,
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
      return [];
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
    const status = req.params.status ? req.params.status : "pending";
    let result;
    if (req.query.invoiceType === "wallet") {
      result = await getWalletInvoices(status);
    } else if (req.query.invoiceType === "profit") {
      result = await getProfitsInvoices(status, req.locale);
    } else if (req.query.invoiceType === "instructorProfits") {
      result = await getInstructorProfitsInvoices(status);
    }
    if (result.length === 0) {
      return res
        .status(404)
        .json({ status: "failed", msg: "no invoices found" });
    }

    return res.status(200).json(result);
  } catch (error) {
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
    return false;
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
  return true;
};
//2
const updateWalletInvoiceStatus = async (id, status) => {
  //1- selecting the marketer
  const marketLog = await MarketingLog.findOne({ "walletInvoices._id": id });
  if (!marketLog) {
    return false;
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
  return true;
};
//@params invoiceId {params}
exports.updateInvoiceStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    let acknowledgement;
    if (req.query.invoiceType === "wallet") {
      acknowledgement = await updateWalletInvoiceStatus(id, status);
    } else if (req.query.invoiceType === "profit") {
      acknowledgement = await updateInvoiceStatus(id, status);
    } else if (req.query.invoiceType === "instructorProfits") {
      acknowledgement = await updateInstructorProfitsInvoiceStatus(id, status);
    }
    if (!acknowledgement) {
      return res
        .status(404)
        .json({ status: "failed", msg: "no invoice found" });
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
  const { profitPercentage, totalSalesMoney, profits, sales, withdrawals } =
    marketLog;
  //validation -----
  //1- check if he has sales
  if (!profits || profits === 0) return marketLog;
  //2- check if he has profits to be calculated
  // const monthBoundaries = getMonthBoundaries();

  // let lastMonthAnalytics = getMonthMoney(
  //   marketLog.invoices,
  //   monthBoundaries.lastMonth.firstDay,
  //   monthBoundaries.lastMonth.lastDay
  // );

  const takenProfits = withdrawals;
  //3- check if he has profits to be calculated
  if (profits === takenProfits) return marketLog;

  //4-calculate the available profits
  const availableProfits = profits - takenProfits;
  //5- create the invoice
  const ordersIds = sales?.map((sale) => sale.order);
  const invoice = {
    totalSalesMoney: totalSalesMoney.toFixed(2),
    mySales: sales.length,
    createdBy: "system",
    orders: ordersIds,
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
  //1-calculate the profits of his wallet (ensure numeric addition)
  profits = marketLog.commissions.reduce(
    (acc, commission) => acc + (Number(commission.profit) || 0),
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
//-----------------------------------------------------
