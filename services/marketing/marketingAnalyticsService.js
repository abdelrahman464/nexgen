const User = require("../../models/userModel");
const Order = require("../../models/orderModel");
const marketLog = require("../../models/MarketingModel");
const ApiError = require("../../utils/apiError");
const _ = require("lodash");
//@desc > detect type of each order's item and return it's title
const getItemDetails = (order, lang = "en") => {
  let itemTitle;

  if (order.course) {
    itemTitle = order.course.title[`${lang}`];
    return { title: itemTitle, type: "course" };
  }
  if (order.package) {
    itemTitle = order.package.title[`${lang}`];
    return { title: itemTitle, type: "package" };
  }
  if (order.coursePackage) {
    itemTitle = order.coursePackage.title[`${lang}`];
    return {
      title: itemTitle,
      type: "coursePackage",
    };
  }
};
/**
 * @description calculate percentage of each item has been sold in total sales since the marketer started
 */
exports.calculateSalesAnalytics = (orders, lang) => {
  const analytics = [];
  //hint : each key inside it will be item_name , it's value object of total (amount sales) and (type) of item
  const analyticsObject = {};
  //accumulate each item sales
  let totalSales = 0;
  let soldItem = {};

  orders.forEach((order) => {
    soldItem = getItemDetails(order, lang);
    console.log(soldItem);
    if (soldItem.title in analyticsObject) {
      analyticsObject[soldItem.title].sales += order.totalOrderPrice;
    } else {
      analyticsObject[soldItem.title] = {
        type: soldItem.type,
        sales: order.totalOrderPrice,
      };
    }
    totalSales += order.totalOrderPrice;
  });
  console.log("ss");
  console.log(analyticsObject);
  //calculate percentage of each item
  let percentage = 0;
  Object.keys(analyticsObject).forEach((key) => {
    percentage = (analyticsObject[key].sales / totalSales) * 100;
    percentage = percentage.toFixed(2);

    analytics.push({
      item: key,
      sales: analyticsObject[key].sales,
      type: analyticsObject[key].type,
      percentage,
    });
  });

  return { totalSales, analytics };
};
//------------------------
/**
 *
 * @param {*} users
 * @returns {Number} number of users who registered in the current month
 */
const getCurrentMonthRegistrations = (users) => {
  const filteredUsers = users.filter(
    (user) => user.createdAt?.getMonth() === new Date().getMonth()
  );
  return filteredUsers.length || 0;
};
//--------------------------------------------------------------------------
/**
 * @description get totalSalesMoney of orders that have been made in (current month)
 * @param {*} orders
 * @returns {Number} totalSalesMoney
 */
const getCurrentMonthSalesMoney = (orders) =>
  orders.reduce((acc, order) => {
    if (order.createdAt?.getMonth() === new Date().getMonth()) {
      return acc + 1;
    }
    return acc;
  }, 0);
//--------------------------------------------------------------------------
//the coming functions are for page1 => analytics
exports.getTotalSalesAnalytics = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const marketerId = req.params.id || req.user._id;
    //get his users
    const users = await User.find({ invitor: marketerId }).select("_id");
    if (users.length === 0)
      throw new ApiError(404, "No users found for this marketer");

    const usersIds = users.map((user) => user._id);
    //get order of his users in this month and year
    const orders = await Order.find({
      user: { $in: usersIds },
    });
    //validation => if no orders return error
    if (orders.length === 0)
      throw new ApiError(404, "No orders found for this marketer");

    //calculate percentage of each item has been sold
    const result = this.calculateSalesAnalytics(orders, lang);
    //get current sales and team size
    const currentRegistrations = getCurrentMonthRegistrations(users);

    return res.status(200).json({
      status: "success",
      totalSales: result.totalSales,
      team: users.length,
      currentMonthRegistrations: currentRegistrations,
      analytics: result.analytics,
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    return res
      .status(statusCode)
      .json({ status: `failed`, error: error.message });
  }
};
//--------------------------------------------------------------------------
/**
 * @description => get analytics(specific data) for a specific item given a specific period compared to opposite period
 */
exports.getItemAnalytics = async (req, res, next) => {
  try {
    const startDate = toISOFormat(req.query.startDate); //ISO date format
    const endDate = toISOFormat(req.query.endDate); //ISO date format

    console.log(startDate);
    console.log(endDate);
    const marketerId = req.query.marketerId || req.user._id;
    const itemId = req.params.id;

    const users = await User.find({ invitor: marketerId }).select("_id");
    if (users.length === 0)
      throw new ApiError(404, "No users found for this marketer");

    const usersIds = users.map((user) => user._id);
    //--------------------------------
    const givenPeriodOrders = await Order.find({
      user: { $in: usersIds },
      $or: [{ course: itemId }, { package: itemId }, { coursePackage: itemId }],
      paidAt: { $gte: startDate, $lte: endDate },
    });
    if (givenPeriodOrders.length === 0)
      return res.status(404).json({
        status: "failed",
        message: "No orders found for this item in this period",
      });
    const givenPeriodSales = givenPeriodOrders.reduce(
      (acc, order) => acc + order.totalOrderPrice,
      0
    );
    //--------------------------------
    const oppositePeriodOrders = await getOppositePeriodOrders(
      itemId,
      startDate,
      endDate
    );
    if (oppositePeriodOrders.length === 0) {
      return res.status(200).json({
        status: `success`,
        //given period data
        givenPeriodSales,
        students: givenPeriodOrders.length,

        //opposite period data
        oppositePeriodSales: 0,
        oppositePeriodStudents: 0,
      });
    }
    const oppositePeriodSales = oppositePeriodOrders.reduce(
      (acc, order) => acc + order.totalOrderPrice,
      0
    );
    const givenPeriodResalesObject = getResalesInfo(givenPeriodOrders);
    const oppositePeriodResalesObject = getResalesInfo(oppositePeriodOrders);

    //response
    return res.status(200).json({
      status: `success`,
      givenPeriodSales,
      givenPeriodStudents: givenPeriodOrders.length,
      oppositePeriodSales,
      oppositePeriodStudents: oppositePeriodOrders.length,
      //resales
      givenPeriodResales: givenPeriodResalesObject.ResalesMoney,
      givenPeriodResalesStudents: givenPeriodResalesObject.ResalesStudents,
      oppositePeriodResales: oppositePeriodResalesObject.ResalesMoney,
      oppositePeriodResalesStudents:
        oppositePeriodResalesObject.ResalesStudents,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ status: "failed", error: err.message });
  }
};

const getResalesInfo = (specificPeriodOrders) => {
  let ResalesMoney = 0;
  let ResalesStudents = 0;
  specificPeriodOrders.forEach((order) => {
    if (order.isResale) {
      ResalesMoney += order.totalOrderPrice;
      ResalesStudents += 1;
    }
  });
  return {
    ResalesMoney,
    ResalesStudents,
  };
};

const getOppositePeriodOrders = async (itemId, startDate, endDate) => {
  //get opposite period orders
  // Calculate the duration between the dates
  const duration = endDate - startDate; // Duration in milliseconds
  // Calculate the opposite period
  const pastEnd = startDate; // Clone the start date
  pastEnd.setDate(pastEnd.getDate() - 1); // Move it one day before the start date
  const pastStart = new Date(pastEnd - duration); // Subtract the duration from pastEnd

  const oppositePeriodOrders = await Order.find({
    $or: [{ course: itemId }, { package: itemId }, { coursePackage: itemId }],
    paidAt: { $gte: pastStart, $lte: pastEnd },
  });
  return oppositePeriodOrders;
};

function toISOFormat(dateString) {
  // Parse the input date (MM/DD/YYYY)
  const [day, month, year] = dateString.split("/").map(Number);
  console.log(day, month, year);
  // Create a Date object
  const date = new Date(Date.UTC(year, month - 1, day));

  // Convert to ISO format
  // return date.toISOString();
  return date;
}
//----------------
//clicks
exports.incrementSignUpClicks = async (req, res) => {
  try {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const month = new Date().getMonth();
    const year = new Date().getFullYear();

    const marketerId = req.params.id;

    const marketLogDoc = await marketLog.findOne({ marketer: marketerId });
    if (!marketLogDoc) {
      return res.status(404).json({
        status: "failed",
        msg: "No marketing logs found for this marketer",
      });
    }
    const clicks = marketLogDoc.clicks;

    //check if this month and year already exists
    const monthIndex = clicks?.findIndex(
      (click) => click.month === months[month] && click.year === year
    );
    if (monthIndex !== -1) {
      clicks[monthIndex].count += 1;
    } else {
      clicks.push({ month: months[month], year, count: 1 });
    }
    await marketLogDoc.save();
    return res.status(200).json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "failed", error: err.message });
  }
};
