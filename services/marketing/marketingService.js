/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const User = require("../../models/userModel");
const MarketingLog = require("../../models/MarketingModel");
const Order = require("../../models/orderModel");
const InstructorProfit = require("../../models/instructorProfitsModel");
const { createMarketerGroupChat } = require("../ChatServices");
const { addMarketerToLeaderBoard } = require("../leaderBoardService");

const InstructorProfitService = require("../instructorProfitsService");
const ApiError = require("../../utils/apiError");
const _ = require("lodash");
//when creating invoice check the date if same month   update invoice  if not create new one

//1
//@desc invite friends to signup throught your code
//@access public
exports.startMarketing = async (req, res) => {
  try {
    //1- check if user already started marketing
    if (req.user.startMarketing) {
      return res
        .status(400)
        .json({ status: "faild", msg: `you already started marketing` });
    }
    //2- check user role to determine his role in marketLog
    let role = "customer";
    if (req.user.role === "admin") {
      role = "marketer";
    } else if (req.user.role === "instructor") {
      role = "instructor";
    }
    //3-perform query to create marketing log
    await MarketingLog.create({
      marketer: req.user._id,
      invitor: req.user.invitor,
      role,
    });
    //4-update user startMarketing field
    await User.findOneAndUpdate(
      { _id: req.user._id },
      { startMarketing: true }
    );
    //5-create group chat
    await createMarketerGroupChat(req.user);
    //6-return response
    return res.status(200).json({
      msg: "success",
      message: `you has started marketing successfully`,
    });
  } catch (error) {
    return res.status(400).json({ error });
  }
};
//--------------------------------------New One
//make function to give instructor
const giveInstructorPercentage = async (data) => {
  try {
    console.log("giving instructor percentage");
    await InstructorProfit.findOneAndUpdate(
      { instructor: data.instructorId },
      {
        $push: {
          //70 => 18 , 30  , 22 wallet
          profits: {
            purchaser: data.childId,
            course: data.item || null,
            profit: (data.amount * 18) / 100,
          },
        },
      }
    );
  } catch (error) {
    console.log(error.message);
  }
};
const updateSellerSales = async (data, profitPercentage, invoices) => {
  console.log("updating seller sales");
  //**update the sales */
  await MarketingLog.findOneAndUpdate(
    { marketer: data.marketerId },
    {
      $push: {
        sales: {
          purchaser: data.purchaser,
          amount: data.amount,
          itemType: data.itemType,
          item: data.item || null,
        },
      },
      $set: {
        totalSalesMoney: data.totalSalesMoney,
        profitPercentage,
        profits: (data.amount * profitPercentage) / 100,
      },
    }
  );
  await addMarketerToLeaderBoard(marketerId, data.totalSalesMoney);
  console.log("updated successfully");
  return true;
  //**update the sales */
};

//---------------------------------------------------------------------------------------------------------------------------------------------------------------------------//
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
    //1- give instructor his profits if exist
    if (details.instructorId && details.instructorId !== null) {
      await giveInstructorPercentage(details);
    }
    //2- get user by email
    const user = await User.findOne({ email: details.email }).select("invitor");
    //3-Validate the exist of user's invitor
    if (!user.invitor) {
      console.log("user has no valid invitor");
      throw new Error("user has no valid invitor");
    }

    //4- get the invitor marketLog to update it
    const marketerMarketLog = await MarketingLog.findOne({
      marketer: user.invitor,
    });
    //5-Validate the exist of invitor marketLog
    if (!marketerMarketLog) {
      console.log("seller has no marketLog");
      throw new Error("seller has no marketLog");
    }
    //6-create data object (instead of sending all these params 'clean code')
    const data = {
      marketerId: marketerMarketLog.marketer,
      purchaser: user._id,
      amount: details.amount,
      itemType: details.itemType,
      item: details.item,
      totalSalesMoney:
        marketerMarketLog.totalSalesMoney + parseFloat(details.amount),
    };
    //7- calculate the percentage
    const profitPercentage = this.detectPercentage(
      marketerMarketLog.role,
      data.totalSalesMoney
    );
    //8- update marketLog with this sale
    await updateSellerSales(data, profitPercentage, marketerMarketLog.invoices);
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
    console.log("success");
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
    console.warn(`head not found will giving him the commission`);
    return;
  }
  const profit =
    ((headMarketLog.profitPercentage - marketerProfitsPercentage) / 100) *
    marketerTotalSalesMoney;

  let hasBeenUpdated = false;
  headMarketLog.commissions.map((commission) => {
    if (commission.member.toString() === marketerId.toString()) {
      //update data
      commission.profit = profit;
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
            profit,
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
exports.getMarketLog = async (req, res) => {
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
      .lean();
    // .populate("transactions.child", "name email profileImg"); //req.user._id
    //3- check existance
    if (!marketLog) {
      throw new ApiError("No marketerLog found", 404);
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
    let result = await this.getMonthMoney(
      marketLog.invoices,
      new Date().getMonth()
    );
    marketLog.withdrawals = result.monthProfits;
    //7- calc what is available to withdraw
    marketLog.availableToWithdraw = marketLog.profits - marketLog.withdrawals;
    //8- get last month salesMoney and profits to calculate difference and performance----------------------
    if (marketLog.invoices.length !== 0) {
      result = await this.getMonthMoney(
        marketLog.invoices,
        new Date().getMonth() - 1 //last month
      );
      if (result.monthSalesMoney !== 0)
        marketLog.salesMoneyDifference =
          marketLog.totalSalesMoney - result.monthSalesMoney;
      if (result.monthProfits !== 0)
        marketLog.profitsDifference = marketLog.profits - result.monthProfits;
    }

    //7- check if the marketer is instructor to get his profits----------------------------
    let instructorProfits = null;
    if (marketLog.role === "instructor") {
      instructorProfits = await InstructorProfitService.getOne(
        marketLog.marketer
      );
    }
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
const createProfitsInvoice = async (marketLog) => {
  let { totalSalesMoney, profits } = marketLog;
  const { profitPercentage, sales } = marketLog;
  //validation -----
  //1- check if he has profits to be calculated
  const takenProfits = await this.getMonthMoney(
    marketLog.invoices,
    new Date().getMonth()
  ).monthProfits;

  if (!profits || profits === 0 || profits === takenProfits)
    throw new ApiError("No profits found to be calculated ", 404);

  //3-calculate the available profits
  const availableProfits = profits - takenProfits;

  //4- create the invoice
  const invoice = {
    totalSalesMoney: totalSalesMoney.toFixed(2),
    mySales: sales.length,
    profitPercentage,
    profits: availableProfits,
  };

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
    profits += wallet.profit;
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
exports.createInvoice = async (req, res) => {
  try {
    //1- Get all marketerLof data
    const marketLog = await MarketingLog.findOne({ marketer: req.params.id });
    //2- check existance
    if (!marketLog) {
      throw new Error("No marketerLog found");
    }
    //3- check which type of invoice to create
    if (req.query.invoiceType === "wallet") {
      if (marketLog.wallet && marketLog.wallet.length === 0)
        throw new ApiError(
          "No wallet balance to be calculated for this user",
          404
        );
      await createWalletInvoice(marketLog, req.body);
    }
    //------------------------------------------------
    else if (req.query.invoiceType === "profit") {
      await createProfitsInvoice(marketLog);
    }
    //------------------------------------------------
    else if (req.query.invoiceType === "instructorProfits") {
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
    let statusCode = 500;
    if (error instanceof ApiError) {
      statusCode = error.statusCode;
    }
    return res.status(statusCode).json({
      status: "failed",
      msg: `Error creating invoices: ${error.message}`,
    });
  }
};
//-----------------------------------------------------------------------------------------------//
exports.getMarketerChildren = async (req, res) => {
  const marketerId = req.params.id;

  const teamMembers = await User.find({ invitor: marketerId })
    .select("name email profileImg createdAt")
    .lean();

  if (teamMembers.length === 0) {
    return res.status(404).json({ status: "failed", msg: "no data found" });
  }
  //get orders for these children
  const result = await filterTeamMembers(teamMembers);
  if (_.isEmpty(result))
    return res
      .status(400)
      .json({ status: "failed", msg: "no orders found for these teamMembers" });

  const {
    totalRegistrations,
    totalSubscribers,
    teamMembers1,
    teamMembers2,
    resaleCounter,
  } = result;
  //check filter if he want to get only the children who have sales
  return res.status(200).json({
    status: "success",
    totalRegistrations,
    totalSubscribers,
    resaleCounter,
    teamMembers1,
    teamMembers2,
  });
};

//---------------
exports.detectPercentage = (role, totalSalesMoney) => {
  let percentage;
  if (role === "head") {
    if (totalSalesMoney < 1000) percentage = 20;
    else if (totalSalesMoney >= 1000 && totalSalesMoney < 2000) percentage = 30;
    else if (totalSalesMoney >= 2000 && totalSalesMoney < 4000) percentage = 40;
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
exports.getMonthMoney = async (invoices, month) => {
  let monthProfits = 0;
  let monthSalesMoney = 0;
  invoices.map((invoice) => {
    if (invoice.createdAt.getMonth() === month) {
      monthProfits += invoice.profits;
      monthSalesMoney += invoice.totalSalesMoney;
    }
  });
  return { monthProfits, monthSalesMoney };
};
//-------------------------------------
//desc: set paymentDetails to marketLog
exports.setPaymentDetails = async (req, res) => {
  try {
    const { paymentMethod, receiverAcc } = req.body;
    const marketerId = req.params.id;
    const marketLog = await MarketingLog.findOne({ marketer: marketerId });
    if (!marketLog) {
      throw new ApiError("No marketerLog found", 404);
    }
    marketLog.paymentDetails = {
      paymentMethod,
      receiverAcc,
    };
    await marketLog.save();
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
//------------------------------------
exports.deleteUnUsed = async () => {
  const membersArray = [
    "6621f90e5834a7385bbf4786",
    "6621f9315834a7385bbf478c",
    "6621f9a45834a7385bbf4796",
  ]; // Example array of IDs
  await MarketingLog.deleteMany({
    _id: { $nin: membersArray }, // Matches docs where _id is NOT in the array
  });

  console.log("Documents deleted successfully, except for specified members.");
};
const filterTeamMembers = async (teamMembers) => {
  let resaleCounter = 0;
  const usersIds = teamMembers.map((user) => user._id);
  const orders = await Order.find({ user: { $in: usersIds } });
  
  if (orders.length === 0) return {};
  //  1.1 - loop on orders and push each order to user.orders
  orders.map((order) => {
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
    totalRegistrations: teamMembers.length,
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
