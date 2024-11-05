/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const User = require("../models/userModel");
const MarketingLog = require("../models/MarketingModel");
const InstructorProfit = require("../models/instructorProfitsModel");
const { createMarketerGroupChat } = require("./ChatServices");
const { addMarketerToLeaderBoard } = require("./leaderBoardService");

const InstructorProfitService = require("./instructorProfitsService");
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
const updateSellerSales = async (data, percentage, invoices) => {
  console.log("updating seller sales");
  //**update the sales */
  await MarketingLog.findOneAndUpdate(
    { marketer: data.marketerId },
    {
      $push: {
        direct_transactions: {
          child: data.childId,
          percentage: percentage,
          amount: data.amount,
          profit: (data.amount * percentage) / 100,
          item: data.item || null,
        },
      },
      $set: {
        totalSalesMoney: data.totalSalesMoney,
      },
    }
  );
  const leaderBoardData = this.calculateTotalSalesMoney(
    data.totalSalesMoney,
    invoices
  );
  leaderBoardData.marketerId = data.marketerId;
  await addMarketerToLeaderBoard(leaderBoardData);
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
    //1- check if this course has instructor and this instructor has percentage
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
      invitorId: marketerMarketLog.invitor ? marketerMarketLog.invitor : null,
      childId: user._id,
      amount: details.amount,
      item: details.item,
      totalSalesMoney:
        marketerMarketLog.totalSalesMoney + parseFloat(details.amount),
    };
    //7- calculate the profits
    if (marketerMarketLog.role === "customer") {
      await updateSellerSales(data, 15, marketerMarketLog.invoices);
      // eslint-disable-next-line no-use-before-define
      await updateCustomerFathers(data);
    } else {
      //marketer or instructor
      await updateSellerSales(data, 30, marketerMarketLog.invoices);
      // eslint-disable-next-line no-use-before-define
      await updateMarketerFathers(data);
    }
    console.log("success");
    return true;
  } catch (error) {
    console.log("error from calculateProfits: ", error.message);
    return error.message;
  }
};

//--------------------------------------------------------------------------------------------------------------------------------------//
const updateMarketerFathers = async (data) => {
  let marketerMarketLog = null;
  let i = 1;
  let percentage = 10;
  let percentageSum = 30; //--> cause we updated the seller before
  while (true) {
    console.log("updating marketer fathers");
    //**start updateign */
    if (data.invitorId === null || i === 3) {
      console.log(`father number ${i} has no invitor`);
      break;
    }

    marketerMarketLog = await MarketingLog.findOneAndUpdate(
      { marketer: data.invitorId },
      {
        $push: {
          transactions: {
            child: data.marketerId,
            percentage: percentage,
            profit: (data.amount * percentage) / 100,
            item: data.item || null,
          },
        },
      },
      { new: true }
    );
    //handle case of marketerMarketLog not exist , so the seller get wallet
    if (!marketerMarketLog) {
      //this scenario will happen when the seller's invitor didn't start marketing
      break;
    }

    percentageSum += percentage;
    data.invitorId = marketerMarketLog.invitor
      ? marketerMarketLog.invitor
      : null;
    i += 1;
    percentage = 7;
  } //end forLoop

  //***set the rest to wallet
  const restPercentage = 52 - percentageSum;
  //اضافه صافي التمويل لاخر شخص خد ربح من الشجره
  const finalMarketerId = marketerMarketLog
    ? marketerMarketLog.marketer
    : data.marketerId;

  await MarketingLog.findOneAndUpdate(
    {
      marketer: finalMarketerId,
    },
    {
      $push: {
        wallet: {
          member: data.marketerId === finalMarketerId ? null : data.marketerId,
          percentage: restPercentage,
          amount: data.amount,
          profit: (data.amount * restPercentage) / 100,
        },
      },
    }
  );
  console.log("wallet updated successfully");
  //TODO
  return "updated successfully";
};
//--------------------------------------------------------------------------------------------------------------------------------------//
const updateCustomerFathers = async (data) => {
  console.log("updating customer fathers");
  let marketerMarketLog = null;
  let i = 1;
  let percentage = 15;
  let percentageSum = 15; //--> cause we updated the seller before
  while (true) {
    //**start updateign */
    if (!data.invitorId || i === 4) {
      break;
    }

    marketerMarketLog = await MarketingLog.findOneAndUpdate(
      { marketer: data.invitorId },
      {
        $push: {
          transactions: {
            child: data.marketerId,
            percentage: percentage,
            profit: (data.amount * percentage) / 100,
            item: data.item || null,
          },
        },
      },
      { new: true }
    );
    //handle case of marketerMarketLog not exist , so the seller get wallet
    if (!marketerMarketLog) {
      //this scenario will happen when the seller's invitor didn't start marketing
      break;
    }
    percentageSum += percentage;
    data.invitorId = marketerMarketLog.invitor;
    i += 1;
    if (i === 2) {
      percentage = 10;
    } else if (i === 3) {
      percentage = 7;
    }
  } //end forLoop
  //***set the rest to wallet
  const restPercentage = 52 - percentageSum;
  //اضافه صافي التمويل لاخر شخص خد ربح من الشجره
  const finalMarketerId = marketerMarketLog
    ? marketerMarketLog.marketer
    : data.marketerId;
  //**udpate b2a */
  await MarketingLog.findOneAndUpdate(
    { marketer: finalMarketerId },
    {
      $push: {
        wallet: {
          member: data.marketerId === finalMarketerId ? null : data.marketerId,
          percentage: restPercentage,
          amount: data.amount,
          profit: (data.amount * percentage) / 100,
        },
      },
    }
  );
  //TODO
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
      .populate("invitor", "name email profileImg")
      .populate("marketer", "name email profileImg")
      .populate("wallet.member", "name email profileImg")
      .populate("direct_transactions.child", "name email profileImg")
      .populate("transactions.child", "name email profileImg"); //req.user._id
    //3- check existance
    if (!marketLog) {
      throw new Error("No marketerLog found");
    }
    //4- calculate the wallet balance
    if (marketLog.wallet.length !== 0) {
      marketLog.walletBalance = marketLog.wallet.reduce(
        (acc, item) => acc + item.profit,
        0
      );
    }
    //5- check if the marketer is instructor to get his profits
    let instructorProits = null;
    if (marketLog.role === "instructor") {
      instructorProits = await InstructorProfitService.getOne(
        marketLog.marketer
      );
    }

    //6- return response
    return res
      .status(200)
      .json({ status: "success", marketLog, instructorProits });
  } catch (error) {
    return res.status(400).json({ status: "faild", msg: error.message });
  }
};
//--------------------------------------------INVOICES Creation----------------------------------------------------------------//
//@desc i will use this function when i pay to user
//embedded function

//function 1 -------------------------
const createProfitsInvoice = async (marketLog, reqBody) => {
  let totalProfits = 0;
  let totalTreeProfits = 0;
  let salesAnalytics;
  //1-calculate the profits of his direct transactions
  if (
    marketLog.direct_transactions &&
    marketLog.direct_transactions.length !== 0
  ) {
    for (const transaction of marketLog.direct_transactions) {
      totalProfits += transaction.profit;
    }
    // eslint-disable-next-line no-use-before-define
    salesAnalytics = calculateSalesAnalytics(
      marketLog.direct_transactions,
      marketLog.totalSalesMoney
    );
  }
  //2-calculate the profits of his children
  if (marketLog.transactions && marketLog.transactions.length !== 0) {
    for (const transaction of marketLog.transactions) {
      totalTreeProfits += transaction.profit;
    }
  }
  //3- check if user has money to be calculated
  if (totalProfits <= 0 && totalTreeProfits <= 0) {
    return {
      statusCode: 400,
      response: {
        status: "faild",
        msg: `No profits to be calculated for this user`,
      },
    };
  }
  //calculate the start point of the invoice
  const startPointDate =
    marketLog.invoices && marketLog.invoices.length > 0
      ? marketLog.invoices[marketLog.invoices.length - 1].createdAt
      : marketLog.createdAt;

  //4- create the invoice
  const invoice = {
    totalSalesMoney: marketLog.totalSalesMoney.toFixed(2),
    mySales: marketLog.direct_transactions.length,
    profits: totalProfits.toFixed(2),
    treeProfits: totalTreeProfits.toFixed(2),
    desc: `Invoice for period : ${startPointDate.toLocaleString("default", {
      month: "long",
    })} ${startPointDate.getDate()} (${startPointDate.toLocaleString("en-US", {
      weekday: "long",
    })}) to  ${new Date().toLocaleString("default", {
      month: "long",
    })} ${new Date().getDate()} (${new Date().toLocaleString("en-US", {
      weekday: "long",
    })})`,
    salesAnalytics, //may be exist and maybe not
    paymentMethod: reqBody.paymentMethod,
    receiverAcc: reqBody.receiverAcc,
  };

  marketLog.invoices.push(invoice);

  //5- Reset the fields
  marketLog.totalSalesMoney = 0;
  marketLog.transactions = [];
  marketLog.direct_transactions = [];

  //6- Save the changes
  await marketLog.save();

  return {
    statusCode: 200,
    response: {
      status: "success",
      msg: `profits' Invoice created successfully`,
    },
  };
};
//function 2 ---------------------
const createWalletInvoice = async (marketLog, reqBody) => {
  let profits = 0;

  //1-calculate the profits of his wallet
  if (marketLog.wallet && marketLog.wallet.length !== 0) {
    for (const wallet of marketLog.wallet) {
      profits += wallet.profit;
    }
  }
  //2- check if user has money to be calculated
  if (profits <= 0) {
    return {
      statusCode: 400,
      response: {
        status: "faild",
        msg: `No wallet profits to be calculated for this user`,
      },
    };
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
    paymentMethod: reqBody.paymentMethod,
    receiverAcc: reqBody.receiverAcc,
  };
  //5- push the invoice to the walletInvoices
  marketLog.walletInvoices.push(invoice);

  //6- Reset the fields
  marketLog.wallet = [];
  //7- Save the changes
  await marketLog.save();

  return {
    statusCode: 200,
    response: {
      status: "success",
      msg: `wallet's Invoice created successfully`,
    },
  };
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
    let result;
    if (req.query.invoiceType === "wallet") {
      result = await createWalletInvoice(marketLog, req.body);
    } else if (req.query.invoiceType === "profit") {
      result = await createProfitsInvoice(marketLog, req.body);
    } else if (req.query.invoiceType === "instructorProfits") {
      result = await InstructorProfitService.createInstructorProfitsInvoice(
        req.params.id,
        req.body
      );
    }
    //4-return the response
    return res.status(result.statusCode).json(result.response);
  } catch (error) {
    console.error("Error creating invoices:", error);

    return res.status(500).json({
      status: "faild",
      msg: `Error creating invoices: ${error.message}`,
    });
  }
};
//-----------------------------------------------------------------------------------------------//
exports.getMarketerChildren = async (req, res) => {
  const marketerId = req.params.id;

  const children = await User.find({ invitor: marketerId }).select(
    "name email profileImg createdAt"
  );

  if (children.length === 0) {
    return res.status(404).json({ status: "faild", msg: "no data found" });
  }

  return res.status(200).json({ status: "success", data: children });
};
//------------------------
const calculateSalesAnalytics = (sales, totalSalesAmount) => {
  const salesAnalytics = [];
  //hint : each key inside it will be item_name , it's value amount of sales for it
  const analytics = {};
  //accumulate each item sales
  for (const sale of sales) {
    if (sale.item in analytics) {
      analytics[sale.item] += sale.amount;
    } else {
      analytics[sale.item] = sale.amount;
    }
  }
  // eslint-disable-next-line guard-for-in
  for (const item in analytics) {
    salesAnalytics.push({
      item: item,
      amount: analytics[item],
      percentage: (analytics[item] / totalSalesAmount) * 100,
    });
  }
  return salesAnalytics;
};
//--------------
exports.calculateTotalSalesMoney = (
  totalSalesMoneyForCurrentMonth,
  invoices
) => {
  //1 - get the current date
  const currentDate = new Date();
  console.log(currentDate);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth()+1; // getMonth() returns 0 for January, 1 for February, etc.
  //2 - calculate the total sales money for the current month from invoices
  let totalSalesMoneyForCurrentMonthInvoices = 0;
  if (invoices.length !== 0) {
    totalSalesMoneyForCurrentMonthInvoices = invoices
      .filter((invoice) => {
        const createdAt = invoice.createdAt;
        return (
          createdAt instanceof Date &&
          createdAt.getFullYear() === currentYear &&
          createdAt.getMonth() === currentMonth
        );
      })
      .reduce((acc, invoice) => acc + invoice.totalSalesMoney, 0);
  }
  const totalSalesMoney =
    totalSalesMoneyForCurrentMonth + totalSalesMoneyForCurrentMonthInvoices;
  //3 - return the data
  console.log(currentMonth, currentYear, totalSalesMoney);
  return { currentMonth, currentYear, totalSalesMoney };
};
