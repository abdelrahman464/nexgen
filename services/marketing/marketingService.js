/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const User = require("../../models/userModel");
const MarketingLog = require("../../models/MarketingModel");
const Order = require("../../models/orderModel");
const InstructorProfit = require("../../models/instructorProfitsModel");
const { createMarketerGroupChat } = require("../ChatServices");
const InstructorProfitService = require("./instructorProfitsService");
const ApiError = require("../../utils/apiError");
const { addMemberToChat } = require("../ChatServices");
const _ = require("lodash");
const { DateTime } = require("luxon");
const {
  createInstructorProfitsDocument,
} = require("./instructorProfitsService");
//when creating invoice check the date if same month   update invoice  if not create new one

//1
//@desc invite friends to signup throught your code
//@access public
exports.startMarketing = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (req.query.type && req.query.type === "instructor") {
      const result = await createInstructorProfitsDocument(userId);
      if (typeof result === "string") {
        return res.status(400).json({ status: "failed", msg: result });
      }
      return res.status(200).json({
        msg: "success",
        message: `this instructor can take profits now`,
      });
    }

    let role;
    if (!role || role === "customer") role = "marketer";

    const isMarketer = await MarketingLog.exists({ marketer: userId });
    //check existance
    //1- check if user already started marketing
    if (isMarketer) {
      return res
        .status(400)
        .json({ status: "failed", msg: `this user already a marketer` });
    }
    const user = await User.findOne({ _id: req.user._id }).select(
      "_id name invitor"
    );
    //3-perform query to create marketing log
    await MarketingLog.create({
      marketer: userId,
      invitor: user.invitor,
      role,
    });
    //4-update user startMarketing field
    await User.findOneAndUpdate({ _id: userId }, { isMarketer: true });
    //5-create group chat
    await createMarketerGroupChat(user);
    //6-return response
    return res.status(200).json({
      msg: "success",
      message: `this user has started marketing successfully`,
    });
  } catch (error) {
    return res.status(400).json({ status: "failed", error: error.message });
  }
};
//--------------------------------------New One

const updateSellerSales = async (data, profitPercentage) => {
  console.log("updating seller sales");
  //**update the sales */
  await MarketingLog.findOneAndUpdate(
    { marketer: data.marketerId },
    {
      $push: {
        sales: {
          purchaser: data.purchaser,
          order: data.order,
          amount: (data.amount || 0).toFixed(2),
          itemType: data.itemType,
          item: data.item || null,
        },
      },
      $set: {
        totalSalesMoney: (data.totalSalesMoney || 0).toFixed(2),
        profitPercentage,
        profits: ((data.totalSalesMoney * profitPercentage) / 100).toFixed(2),
      },
    }
  );
  console.log("updated successfully");
  return true;
  //**update the sales */
};

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------//
// fot testing purpose
exports.calculateProfitsManual = async (
  //don't forget to send amount here and email
  req,
  res
) => {
  try {
    const { details } = req.body;

    const result = await this.calculateProfits(details);
    if (result !== true) {
      return res.status(200).json({ status: "failed", msg: result });
    }
    return res
      .status(200)
      .json({ status: "success", msg: "profits calculated successfully" });
    //8- return response
  } catch (error) {
    console.log("error from calculateProfits: ", error.message);
    return res.status(400).json({ error: error.message });
  }
};
//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------//
//@desc calculate the profit for marketers
//@params  userId(mongoId) amount(int)
//prerequests => add to users collection {balance , invitorId}
exports.calculateProfits = async (
  details //email , amount , item
) => {
  try {
    const user = await User.findOne({ email: details.email }).select("invitor");
    //3-Validate the exist of user's invitor
    if (!user.invitor) {
      console.log("user has no valid invitor");
      throw new Error("user has no valid invitor");
    }
    await addMemberToChat(user._id, user.invitor);
    //4- get the invitor marketLog to update it
    const marketerMarketLog = await MarketingLog.findOne({
      marketer: user.invitor,
    }).select("-sales -invoices -createdAt -updatedAt");
    //5-Validate the exist of invitor marketLog
    if (!marketerMarketLog) {
      console.log("seller has no marketLog");
      throw new Error("seller has no marketLog");
    }
    //6-create data object (instead of sending all these params 'clean code')
    const data = {
      marketerId: marketerMarketLog.marketer,
      purchaser: user._id,
      order: details.order,
      amount: details.amount,
      itemType: details.itemType,
      item: details.item,
      totalSalesMoney:
        marketerMarketLog.totalSalesMoney + parseFloat(details.amount),
    };

    //7- calculate the percentage
    let profitPercentage;
    if (
      marketerMarketLog.profitsCalculationMethod &&
      marketerMarketLog.profitsCalculationMethod == "manual"
    ) {
      profitPercentage = marketerMarketLog.profitPercentage;
    } else {
      profitPercentage = this.detectPercentage(
        marketerMarketLog.role,
        data.totalSalesMoney
      );
    }
    //8- update marketLog with this sale
    await updateSellerSales(data, profitPercentage);
    //9- update current user object in his head.transaction (not sure about this approach till now)
    if (marketerMarketLog.role !== "head" && marketerMarketLog.invitor) {
      //create or update current marketer object in his father.treeProfits
      await updateHeadCommission({
        marketerId: marketerMarketLog.marketer,
        invitorId: marketerMarketLog.invitor,
        marketerTotalSalesMoney: data.totalSalesMoney,
        marketerProfitsPercentage: profitPercentage,
      });
    }
    //10- end of function , thank you :)
    console.log("(calculateProfits) completed");
    return true;
  } catch (error) {
    console.log("error from calculateProfits: ", error.message);
    return error.message;
  }
};
//--------------------------------------------------------------------------------------------------------------------------------------//
/**
 * @param {marketerPercentage : marketerTotalSalesMoney}
 * data i want to store , member , profit i get from it , lastUpdate
 */
const updateHeadCommission = async (data) => {
  console.log("updating customer fathers");
  //destructure data
  const {
    marketerId,
    invitorId,
    marketerTotalSalesMoney,
    marketerProfitsPercentage,
  } = data;
  //get head marketLog
  const headMarketLog = await MarketingLog.findOne({
    marketer: invitorId,
  });
  if (!headMarketLog) {
    console.warn(`head not found`);
    return;
  }
  //----------------------------------------
  let commissionsProfitsPercentage;
  if (
    headMarketLog.commissionsProfitsCalculationMethod &&
    headMarketLog.commissionsProfitsCalculationMethod === "manual"
  ) {
    commissionsProfitsPercentage = headMarketLog.commissionsProfitsPercentage;
  } else {
    commissionsProfitsPercentage =
      headMarketLog.profitPercentage - marketerProfitsPercentage;
  }
  //--------------------------------------
  const profit = (commissionsProfitsPercentage / 100) * marketerTotalSalesMoney;

  let hasBeenUpdated = false;
  headMarketLog.commissions.map((commission) => {
    if (commission.member.toString() === marketerId.toString()) {
      //update data
      commission.profit = profit.toFixed(2);
      commission.lastUpdate = new Date();
      hasBeenUpdated = true;
    }
  });
  if (hasBeenUpdated) await headMarketLog.save();
  else {
    await MarketingLog.findOneAndUpdate(
      {
        marketer: invitorId,
      },
      {
        $push: {
          commissions: {
            member: marketerId,
            profit: profit.toFixed(2),
          },
        },
      }
    );
  }
  //TODO
  console.log("commission updated successfully");
  return "updated successfully";
};
//-----------------------------------------------------------------------------------------------------------------------//
exports.getMarketLog = async (req, res, next) => {
  try {
    //1- extract the marketerId
    const marketerId = req.params.id || req.user._id;
    //2- get the marketLog
    const marketLog = await MarketingLog.findOne({
      marketer: marketerId,
    })
      .populate("marketer", "name email profileImg")
      .populate("invitor", "name email profileImg")
      .populate("sales.purchaser", "name email profileImg")
      .populate("commissions.member", "name email profileImg")
      .lean();
    // .populate("transactions.child", "name email profileImg"); //req.user._id
    //3- check existance
    if (!marketLog) {
      return next(
        new ApiError(res.__(`marketing-errors.marketLog-Not-Found`), 404)
      );
    }
    //4- calculate the commission & wallet balance
    if (marketLog.commissions?.length !== 0) {
      marketLog.walletBalance = marketLog.commissions?.reduce(
        (acc, item) => acc + item.profit / 2,
        0
      );
      marketLog.commissionsBalance = marketLog.walletBalance;
    }
    //5- calculate profits -------------------------------------------
    marketLog.profits =
      marketLog.totalSalesMoney * (marketLog.profitPercentage / 100);
    //6- get withdrawals money in current money -----------------------
    const monthBoundaries = this.getMonthBoundaries();

    let currentMonthAnalytics =  this.getMonthMoney(
      marketLog.invoices,
      monthBoundaries.currentMonth.firstDay,
      monthBoundaries.currentMonth.lastDay
    );
    console.log(currentMonthAnalytics);
    marketLog.withdrawals = currentMonthAnalytics.monthProfits;
    //7- calc what is available to withdraw
    marketLog.availableToWithdraw = marketLog.profits - marketLog.withdrawals;
    //8- get last month salesMoney and profits to calculate difference and performance----------------------
    if (marketLog.invoices.length !== 0) {
      const lastMonthAnalytics =  this.getMonthMoney(
        marketLog.invoices,
        monthBoundaries.lastMonth.firstDay,
        monthBoundaries.lastMonth.lastDay
      );
      console.log(lastMonthAnalytics);
      if (lastMonthAnalytics.monthSalesMoney !== 0)
        marketLog.salesMoneyDifference =
          marketLog.totalSalesMoney - lastMonthAnalytics.monthSalesMoney;
      if (lastMonthAnalytics.monthProfits !== 0)
        marketLog.profitsDifference =
          marketLog.profits - lastMonthAnalytics.monthProfits;
    }

    //7- check if the marketer is instructor to get his profits----------------------------
    let instructorProfits = null;
    if (marketLog.role === "instructor") {
      instructorProfits = await InstructorProfitService.getOne(
        marketLog.marketer
      );
    }

    marketLog.sales?.map((sale) => {
      sale.item = sale.item[req.locale];
    });

    //8- return response
    return res
      .status(200)
      .json({ status: "success", marketLog, instructorProfits });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    return res
      .status(statusCode)
      .json({ status: "failed", msg: error.message });
  }
};
//--------------------------------------------INVOICES Creation----------------------------------------------------------------//
//@desc i will use this function when i pay to user
//embedded function
//function 1 -------------------------
const createProfitsInvoice = async (marketLog, amount) => {
  let { totalSalesMoney, profits } = marketLog;
  const { profitPercentage, sales } = marketLog;
  //validation -----
  //1- check if he has profits to be calculated
  const monthBoundaries = this.getMonthBoundaries();

  let lastMonthAnalytics = this.getMonthMoney(
    marketLog.invoices,
    monthBoundaries.lastMonth.firstDay,
    monthBoundaries.lastMonth.lastDay
  );

  const takenProfits = lastMonthAnalytics.monthProfits;

  if (!profits || profits === 0 || profits === takenProfits) {
    return "marketing-errors.No-Profits-Found";
  }
  //3-calculate the available profits
  const availableProfits = profits - takenProfits;
  if (availableProfits < amount) {
    return "marketing-errors.balance-Not-Enough";
  }

  //4- create the invoice
  const invoice = {
    totalSalesMoney: totalSalesMoney.toFixed(2),
    mySales: sales.length,
    profitPercentage,
    profits: amount,
  };
  marketLog.withdrawals += amount;
  marketLog.invoices.push(invoice);
  //6- Save the changes
  await marketLog.save();

  return true;
};
//function 2 ---------------------
const createWalletInvoice = async (marketLog, reqBody) => {
  let profits = 0;

  //1-calculate the profits of his wallet
  for (const wallet of marketLog.wallet) {
    profits += Number(wallet.profit) || 0;
  }
  //3- calculate the start point of the invoice
  const startPointDate =
    marketLog.walletInvoices && marketLog.walletInvoices.length > 0
      ? marketLog.walletInvoices[marketLog.walletInvoices.length - 1].createdAt
      : marketLog.createdAt;

  //4- create the invoice
  const invoice = {
    profits: profits.toFixed(2),
    desc: `wallet Invoice for period : ${startPointDate.toLocaleString(
      "default",
      {
        month: "long",
      }
    )} ${startPointDate.getDate()} (${startPointDate.toLocaleString("en-US", {
      weekday: "long",
    })}) to  ${new Date().toLocaleString("default", {
      month: "long",
    })} ${new Date().getDate()} (${new Date().toLocaleString("en-US", {
      weekday: "long",
    })})`,

    reasonToWithdraw: reqBody.reasonToWithdraw,
  };
  //5- push the invoice to the walletInvoices
  marketLog.walletInvoices.push(invoice);
  //6- Reset the fields
  marketLog.wallet = [];
  //7- Save the changes
  await marketLog.save();
  return true;
};
//main function
exports.createInvoice = async (req, res, next) => {
  try {
    //1- Get all marketerLof data

    if (!req.query.type || req.query.type === "marketer") {
      const marketLog = await MarketingLog.findOne({ marketer: req.params.id });
      //2- check existance
      if (!marketLog) {
        next(new ApiError(res.__(`marketing-error.marketLog-Not-Found`), 404));
      }

      const result = await createProfitsInvoice(marketLog, req.body.amount);
      if (typeof result === "string") {
        return next(new ApiError(res.__(result), 404));
      }
    } else if (req.query.type === "instructor") {
      await InstructorProfitService.createInstructorProfitsInvoice(
        req.params.id,
        req.body
      );
    }
    //4-return the response
    return res
      .status(200)
      .json({ status: `success`, msg: `invoice created successfully` });
  } catch (error) {
    console.error("Error creating invoices:", error.message);
    next(new ApiError(error.message, 500));
  }
};
//-----------------------------------------------------------------------------------------------//
exports.getMarketerChildren = async (req, res, next) => {
  try {
    const marketerId = req.params.id;

    const teamMembers = await User.find({ invitor: marketerId })
      .select("name email phone profileImg createdAt timeSpent")
      .lean();

    if (teamMembers.length === 0) {
      return next(
        new ApiError(res.__(`marketing-errors.No-Team-Members`), 404)
      );
    }
    // Manually transform profileImg for each team member
    teamMembers.forEach((member) => {
      member = setProfileImageURL(member); // Your transformation logic
    });
    //get orders for these children
    const result = await filterTeamMembers(teamMembers, req.locale);

    const { totalSubscribers, teamMembers1, teamMembers2, resaleCounter } =
      result;
    //check filter if he want to get only the children who have sales
    return res.status(200).json({
      status: "success",
      totalRegistrations: teamMembers.length,
      totalSubscribers,
      resaleCounter,
      teamMembers1,
      teamMembers2,
    });
  } catch (error) {
    next(new ApiError(error.message, 500));
  }
};

//---------------
exports.detectPercentage = (role, totalSalesMoney) => {
  let percentage;
  if (role === "head") {
    if (totalSalesMoney < 1000) percentage = 20;
    else if (totalSalesMoney >= 1000 && totalSalesMoney < 2000) percentage = 30;
    else if (totalSalesMoney >= 2000 && totalSalesMoney < 3000) percentage = 40;
    else percentage = 50;
  } else if (role === "marketer") {
    if (totalSalesMoney < 1000) percentage = 15;
    else if (totalSalesMoney >= 1000 && totalSalesMoney < 2000) percentage = 20;
    else percentage = 30;
  }

  return percentage;
};
//-------------------------------------
//desc : this function return the total profits and total sales money from invoices for a specific month
exports.getMonthMoney = (invoices, startDate, endDate) => {
  let monthProfits = 0;
  let monthSalesMoney = 0;

  invoices.map((invoice) => {
    // Convert ISO strings to Date objects for comparison
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (startDateObj <= invoice.createdAt && invoice.createdAt <= endDateObj) {
      monthProfits += invoice.profits;
      monthSalesMoney += invoice.totalSalesMoney;
    }
  });

  return { monthProfits, monthSalesMoney };
};
//------------------------------------------------------------
//desc: set paymentDetails to marketLog
exports.setPaymentDetails = async (req, res) => {
  try {
    const { paymentMethod, receiverAcc } = req.body;
    const marketerId = req.params.id;

    if (req.query.type && req.query.type === "instructor") {
      await InstructorProfitService.setInstructorProfitsPaymentDetails({
        paymentMethod,
        receiverAcc,
        instructorId: marketerId,
      });
    } else {
      const marketLog = await MarketingLog.findOne({ marketer: marketerId });
      if (!marketLog) {
        throw new ApiError("No marketerLog found", 404);
      }
      marketLog.paymentDetails = {
        paymentMethod,
        receiverAcc,
      };
      await marketLog.save();
    }
    return res
      .status(200)
      .json({ status: "success", msg: "payment details added successfully" });
  } catch (error) {
    console.log("error from setPaymentDetails: ", error.message);
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    return res.status(statusCode).json({ error: error.message });
  }
};
//------------------------------------
//  */
const filterTeamMembers = async (teamMembers, lang) => {
  let resaleCounter = 0;
  const usersIds = teamMembers.map((user) => user._id);
  const orders = await Order.find({ user: { $in: usersIds } });

  if (orders.length === 0)
    return {
      totalSubscribers: 0,
      teamMembers1: [], //cause there are no orders
      teamMembers2: teamMembers, //cause there are no orders
      resaleCounter,
    };

  const localizedOrders = Order.schema.methods.toJSONLocalizedOnly(
    orders,
    lang
  );
  //  1.1 - loop on orders and push each order to user.orders
  localizedOrders.map((order) => {
    if (order.isResale) resaleCounter++;
    teamMembers.map((member) => {
      if (member._id.toString() === order.user._id.toString()) {
        if (!member.orders) member.orders = [];
        member.orders.push(order);
      }
    });
  });
  const teamMembers1 = [];
  const teamMembers2 = [];
  teamMembers.map((member) => {
    if (member.orders) teamMembers1.push(member);
    else teamMembers2.push(member);
  });

  return {
    totalSubscribers: teamMembers1.length,
    teamMembers1,
    teamMembers2,
    resaleCounter,
  };
};
// what types of filter
/**
 * 1- the ones who have sales
 * 2- the ones who don't have sales
 *  2.1 - loop on orders and push each distinct order to user.orders
 *  2.2 - filter users who don't have orders
 */
//-----------------------------------------------------------------
exports.modifyInvitationKeys = async (req, res) => {
  try {
    const { option } = req.query;
    const marketLog = await MarketingLog.findOne({
      marketer: req.params.id,
    }).select("_id invitationKeys");
    if (!marketLog) throw new ApiError("No marketerLog found", 404);

    if (!option || option === "add") {
      const { invitationKey } = req.body;
      marketLog.invitationKeys.push(invitationKey);
    }
    if (option === "remove") {
      const { invitationKey } = req.body;
      marketLog.invitationKeys = marketLog.invitationKeys.filter(
        (key) => key !== invitationKey
      );
    }
    await marketLog.save();
    return res.status(200).json({ status: "success", msg: "done" });
  } catch (error) {
    console.log("error from modifyInvitationKeys: ", error.message);
    return res.status(500).json({ error: error.message });
  }
};
//------------------------------------------------------------------
exports.moveOrdersFromOneToOne = async (exporter, importer, userId) => {
  try {
    const exporterLog = await MarketingLog.findOne({
      marketer: exporter,
      sales: { $size: { $ne: 0 } },
    });
    if (!exporterLog) return "No orders found";
    const importerLog = await MarketingLog.findOne({ marketer: importer });
    if (!importerLog) return "No importer found";

    exporterLog.sales = exporterLog.sales.filter(
      (sale) => sale.purchaser.toString() !== userId.toString()
    );
    const userOrders = exporterLog.sales.filter(
      (sale) => sale.purchaser.toString() === userId.toString()
    );
    importerLog.sales.push(...userOrders);

    const totalOrderMoney = userOrders.reduce(
      (acc, order) => acc + order.amount,
      0
    );

    importerLog.totalSalesMoney += totalOrderMoney;
    const newPercentage = this.detectPercentage(
      importerLog.role,
      importerLog.totalSalesMoney
    );
    importerLog.profitPercentage = newPercentage;
    importerLog.profits = (importerLog.totalSalesMoney * newPercentage) / 100;

    await importerLog.save();
    await exporterLog.save();
    return true;
  } catch (error) {
    console.log("error from moveOrdersFromOneToOne: ", error.message);
    throw new Error(error.message);
  }
};
//------------------------
const setProfileImageURL = (doc) => {
  //return image base url + image name
  if (doc.profileImg) {
    const profileImageUrl = `${process.env.BASE_URL}/users/${doc.profileImg}`;
    doc.profileImg = profileImageUrl;
  }
  if (doc.coverImg) {
    const coverImgUrl = `${process.env.BASE_URL}/users/${doc.coverImg}`;
    doc.coverImg = coverImgUrl;
  }
  if (doc.idDocuments) {
    const imageListWithUrl = [];
    doc.idDocuments.forEach((image) => {
      const imageUrl = `${process.env.BASE_URL}/users/idDocuments/${image}`;
      imageListWithUrl.push(imageUrl);
    });
    doc.idDocuments = imageListWithUrl;
  }

  return doc;
};
//========================================
exports.updateMarketLogProfitsCalculationMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const marketLog = await MarketingLog.findOne({ _id: id });
    if (!marketLog) {
      return res
        .status(404)
        .json({ status: "failed", msg: "MarketLog not found" });
    }
    const { profitsCalculationMethod, commissionsProfitsCalculationMethod } =
      req.body;

    let { profitPercentage, commissionsProfitsPercentage } = req.body;

    if (profitsCalculationMethod == "auto") {
      const { role, totalSalesMoney } = marketLog;
      profitPercentage = this.detectPercentage(role, totalSalesMoney);
    }
    await MarketingLog.findOneAndUpdate(
      { _id: id },
      {
        profitsCalculationMethod,
        profitPercentage,
        commissionsProfitsCalculationMethod,
        commissionsProfitsPercentage,
      }
    );
    return res.status(200).json({
      status: "success",
      msg: "MarketLog profits calculation method updated successfully",
    });
  } catch (error) {
    return res.status(500).json({ status: "failed", msg: error.message });
  }
};

// General function to get current month and last month boundaries
exports.getMonthBoundaries = () => {
  const now = DateTime.now();

  const currentMonth = {
    firstDay: now.startOf("month").toISO(),
    lastDay: now.endOf("month").toISO(),
  };

  const lastMonth = {
    firstDay: now.minus({ months: 1 }).startOf("month").toISO(),
    lastDay: now.minus({ months: 1 }).endOf("month").toISO(),
  };

  return {
    currentMonth,
    lastMonth,
  };
};
