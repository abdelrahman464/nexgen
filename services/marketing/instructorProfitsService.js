const InstructorProfit = require("../../models/instructorProfitsModel");
const ApiError = require("../../utils/apiError");
const Course = require("../../models/courseModel");
const Order = require("../../models/orderModel");
const Package = require("../../models/packageModel");
const CoursePackage = require("../../models/coursePackageModel");
const User = require("../../models/userModel");
const { calculateSalesAnalytics } = require("./marketingAnalyticsService");
//-----------------------------------------------------
exports.createInstructorProfitsDocument = async (instructor) => {
  // eslint-disable-next-line no-useless-catch
  //1- check if this instructor has a profit object
  const instructorProfit = await InstructorProfit.findOne({
    instructor,
  });
  if (instructorProfit) {
    return "instructor profits already exists";
  }
  const user = await User.findOne({ _id: instructor }).select(
    "_id isInstructor"
  );
  if (!user) {
    return "this instructor don't exists";
  }
  if (!user.isInstructor) {
    return "this user is not an instructor";
  }
  //2- if not create one
  await InstructorProfit.create({ instructor });
  return true;
};
//---------------------------------------------------
exports.getOne = async (instructorId) => {
  try {
    const instructorProfit = await InstructorProfit.findOne({
      instructor: instructorId,
    });
    return instructorProfit;
  } catch (err) {
    console.log(err.message);
    throw err;
  }
};
//---------------------------------------------------
exports.deleteOne = async (instructorId) => {
  try {
    await InstructorProfit.findOneAndDelete({ instructor: instructorId });
    return true;
  } catch (err) {
    console.log(err.message);
    throw err;
  }
};
//---------------------------------------------------
exports.createInstructorProfitsInvoice = async (instructorId, reqBody) => {
  //1- find the instructor profits
  const { amount } = reqBody;
  const instructorProfits = await InstructorProfit.findOne({
    instructor: instructorId,
  });
  //2- check if instructor profits found
  if (!instructorProfits) {
    throw new ApiError("No instructor profits found", 404);
  }
  //3- check if user has money to be calculated
  if (instructorProfits.profits === 0) {
    throw new ApiError("No profits found to be calculated", 404);
  }
  const availableProfits = instructorProfits.profits - instructorProfits.withdrawals;
  if (amount > availableProfits) {
    throw new ApiError("amount is greater than profits", 404);
  }

  //5- calculate start point date of this invoice
  const startPointDate =
    instructorProfits.invoices && instructorProfits.invoices.length > 0
      ? instructorProfits.invoices[instructorProfits.invoices.length - 1]
          .createdAt
      : instructorProfits.createdAt;

  //6- push the invoice
  instructorProfits.invoices.push({
    totalSalesMoney: instructorProfits.totalSalesMoney,
    profits: amount,
    desc: `Invoice for period : ${startPointDate.toLocaleString(
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
  });
  // instructorProfits.profits -= amount;
  instructorProfits.withdrawals += amount;
  await instructorProfits.save();
  //9- return success
  return true;
};
//---------------------------------------------------
//@desc : get all instructor profits invoices
//@usage: ./marketingInvoicesService.js => getAllRequestedInvoices
exports.getInstructorProfitsInvoices = async (status) => {
  const instructorProfitsInvoices = await InstructorProfit.find({
    "invoices.status": status,
  }).populate("instructor", "name email profileImg");
  //check if no invoices found
  if (instructorProfitsInvoices.length === 0) {
    throw new ApiError(`No invoices with status ${status}`, 404);
  }
  // Filter only the invoices with the specified status
  const invoices = instructorProfitsInvoices.map((log) => ({
    _id: log._id,
    role: "instructor",
    marketer: log.instructor,
    invoices: log.invoices.filter((invoice) => invoice.status === status),
  }));
  //send the response
  return {
    status: "success",
    length: invoices.length,
    data: invoices,
  };
};
//---------------------------------------------------
//@desc: update invoice status
//@usage: ./marketingInvoicesService.js => updateInvoiceStatus
exports.updateInstructorProfitsInvoiceStatus = async (invoiceId, status) => {
  //1- find the invoice
  const instructorProfitsObject = await InstructorProfit.findOne({
    "invoices._id": invoiceId,
  });
  //2- check if invoice found
  if (!instructorProfitsObject) {
    return false;
  }
  //3- update the invoice status
  instructorProfitsObject.invoices.id(invoiceId).status = status;
  //4- save the invoice
  await instructorProfitsObject.save();
  //5- return success
  return true;
};
//---------------------------------------------------
//make function to give instructor
exports.giveInstructorHisCommission = async (data) => {
  try {
    console.log("giving instructor percentage");
    // const profit = (data.amount * data.instructorPercentage) / 100;
    await InstructorProfit.findOneAndUpdate(
      { instructor: data.instructorId },
      {
        $inc: {
          profits: data.netInstructorProfit,
          totalSalesMoney: data.amount,
        },
        $push: {
          commissions: {
            order: data.order,
            type: data.itemType,
            amount: data.amount,
            percentage: data.instructorPercentage,
            totalProfits: data.totalProfits,
            profit : data.netInstructorProfit,
            marketer: data.invitor || null,
            marketerPercentage: (data.headMarketerPercentage || data.marketerPercentage)|| 0,
            marketerProfits: data.totalMarketingProfits|| 0,
            createdAt: new Date(),
          },
        },
      }
    );
    await Order.findOneAndUpdate(
      { _id: data.order },
      {
        instructorPercentage: data.instructorPercentage,
        instructorProfits: data.totalProfits,
      }
    );
    return;
  } catch (error) {
    console.log(error.message);
  }
};
//-----------
exports.setInstructorProfitsPaymentDetails = async ({
  paymentMethod,
  receiverAcc,
  instructorId,
}) => {
  const instructorProfits = await InstructorProfit.findOne({
    instructor: instructorId,
  });
  if (!instructorProfits) {
    throw new ApiError("No instructorProfits found", 404);
  }

  instructorProfits.paymentMethod = paymentMethod;
  instructorProfits.receiverAcc = receiverAcc;
  await instructorProfits.save();
  return true;
};
//------------------------------------------------------
// get instructor total students total students and total sales for current month and total revenue for current month
exports.getInstructorAnalytics = async (req, res) => {
  try {
    //for admin usage or instructor usage
    const instructorId = req.params.id || req.user._id;
    const instructorProfits = await InstructorProfit.findOne({
      instructor: instructorId,
    }).populate("instructor", "name email profileImg");
    if (!instructorProfits) {
      return res.status(404).json({
        status: "error",
        message: "InstructorProfits document not found",
      });
    }
    const courses = await Course.find({ instructor: instructorId }).select(
      "_id"
    );
    const coursesIds = courses.map((course) => course._id);
    const packages = await Package.find({ instructor: instructorId }).select(
      "_id"
    );
    const packagesIds = packages.map((pack) => pack._id);
    const totalEnrollments = await Order.count({
      $or: [{ course: { $in: coursesIds } }, { package: { $in: packagesIds } }],
    });
    //calculate avg rate
    const avgRate = 4;
    const totalEnrollmentsDiff = 32; //need to calculate
    const avgRateDiff = 1.3;
    const instructorProfitsDiff = 300; //need to calculate
    //need to add avg rate
    return res.status(200).json({
      status: "success",
      totalEnrollments,
      totalEnrollmentsDiff,
      avgRate,
      avgRateDiff,
      instructorProfits: instructorProfits.profits || 0,
      instructorProfitsDiff,
      withdrawals: instructorProfits.withdrawals || 0,
      totalSalesMoney: instructorProfits.totalSalesMoney || 0,
      commissions:instructorProfits.commissions || [],
      invoices:instructorProfits.invoices || [],
    });
  } catch (error) {
    console.log(error.message);
  }
};
//------------------------------------------------------
// Get course analytics: total sales and registered users with optional date filtering
exports.getCourseAnalytics = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { startDate, endDate } = req.query;
    const { type } = req.query;
    if (!type) {
      return res.status(400).json({
        status: "error",
        message: "type query parameter is required",
      });
    }
    if (!["course", "package", "coursePackage"].includes(type)) {
      return res.status(400).json({
        status: "error",
        message: "type query parameter is invalid",
      });
    }
    const item = await getItemData(type, itemId);
    if (!item) {
      return res.status(404).json({
        status: "error",
        message: "Item not found",
      });
    }

    // Build date filter if provided
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};

      if (startDate) {
        // Parse DD/MM/YYYY format
        const [day, month, year] = startDate.split("/");
        const startDateTime = new Date(year, month - 1, day, 0, 0, 0); // Start of day
        dateFilter.createdAt.$gte = startDateTime;
      }

      if (endDate) {
        // Parse DD/MM/YYYY format
        const [day, month, year] = endDate.split("/");
        const endDateTime = new Date(year, month - 1, day, 23, 59, 59); // End of day
        dateFilter.createdAt.$lte = endDateTime;
      }
    }

    // Build query filter
    const queryFilter = {
      isPaid: true, // Only count paid orders
      ...dateFilter,
    };
    switch (type) {
      case "course":
        queryFilter.course = itemId;
        break;
      case "package":
        queryFilter.package = itemId;
        break;
      case "coursePackage":
        queryFilter.coursePackage = itemId;
        break;
    }

    // Get orders for this course with user details
    const orders = await Order.find(queryFilter).select(
      "totalOrderPrice user createdAt"
    );

    // Calculate total sales
    const totalSales = orders.reduce(
      (sum, order) => sum + (order.totalOrderPrice || 0),
      0
    );

    // Get unique registered users
    const uniqueUsers = [];
    // const userIds = new Set();

    orders.forEach((order) => {
      if (order.user) {
        // userIds.add(order.user._id.toString());
        uniqueUsers.push({
          _id: order.user._id || "",
          name: order.user.name || "",
          email: order.user.email || "",
          profileImg: order.user.profileImg || "",
          isResale: order.isResale || false,
          paidAt: order.paidAt || "",
          createdAt: order.createdAt || "",
        });
      }
    });

    return res.status(200).json({
      status: "success",
      item: {
        _id: item._id,
        title: item.title,
        price: item.price,
        instructor: item.instructor,
      },
      totalSales,
      totalRegisteredUsers: uniqueUsers.length,
      registeredUsers: uniqueUsers,

      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      error: error.message,
    });
  }
};

//-----------
const getItemData = async (type, itemId) => {
  switch (type) {
    case "course":
      return await Course.findById(itemId).select("title price instructor");
    case "package":
      return await Package.findById(itemId).select("title price instructor");
    case "coursePackage":
      return await CoursePackage.findById(itemId);
    default:
      throw new Error("Invalid item type");
  }
};

//the coming functions are for page1 => analytics
exports.getTotalSalesAnalytics = async (req, res, next) => {
  try {
    const lang = req.locale;
    const instructorId = req.params.id || req.user._id;

    const filter = {
      instructor: instructorId,
    };
    if (req.query.month) {
      filter.createdAt = getMonthRange(req.query.month);
    }

    const orders = await Order.find(filter);
    //validation => if no orders return error
    if (orders.length === 0)
      throw new ApiError("No orders found for this instructor", 404);

    //calculate percentage of each item has been sold
    const result = calculateSalesAnalytics(orders, lang);
    //get current sales and team size
    const currentRegistrations = getCurrentMonthRegistrations(orders);

    return res.status(200).json({
      status: "success",
      month: req.query.month,
      totalSales: result.totalSales,
      currentMonthRegistrations: currentRegistrations,
      analytics: result.analytics,
    });
  } catch (error) {
    // const statusCode = error instanceof ApiError ? error.statusCode : 500;
    return next(new ApiError(error.message, 400));
  }
};

function getMonthRange(yyyyMm) {
  // Validate input format (yyyy-mm)
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) {
    throw new Error('Invalid date format. Please use "yyyy-mm"');
  }

  const [year, month] = yyyyMm.split("-").map(Number);

  // Create date for the first moment of the month
  const firstDay = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));

  // Last millisecond of the month (UTC)
  const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  return {
    $gte: firstDay,
    $lte: lastDay,
  };
}
const getCurrentMonthRegistrations = (orders) => {
  const filteredUsers = orders.filter(
    (order) => order.user.createdAt?.getMonth() === new Date().getMonth()
  );
  return filteredUsers.length || 0;
};
//---------------------------
exports.getSalesAnalytics = async (req, res) => {
  try {
    const instructorId = req.params.id || req.user._id;
    
    // Get all instructor's items
    const courses = await Course.find({ instructor: instructorId });
    const coursesIds = courses.map((course) => course._id);
    const packages = await Package.find({ instructor: instructorId });
    const packagesIds = packages.map((pack) => pack._id);
    const coursePackages = await CoursePackage.find({ instructor: instructorId });
    const coursePackagesIds = coursePackages.map((cp) => cp._id);
    
    // Initialize sales object
    const sales = {};
    
    // Batch settings
    const batchSize = 100; // Fetch 100 orders per batch
    let skip = 0;
    let hasMore = true;
    
    // Fetch orders in batches
    while (hasMore) {
      const orders = await Order.find({
        $or: [
          { course: { $in: coursesIds } },
          { package: { $in: packagesIds } },
          { coursePackage: { $in: coursePackagesIds } }
        ],
        isPaid: true // Only count paid orders
      })
      .select('course package coursePackage totalOrderPrice')
      .skip(skip)
      .limit(batchSize)
      .lean();
      
      // If no orders returned, stop the loop
      if (orders.length === 0) {
        hasMore = false;
        break;
      }
      
      orders.forEach((order) => {
        const itemId = order.course || order.package || order.coursePackage;
        
        if (itemId) {
          const itemIdStr = itemId._id.toString();
          
          // Initialize if not exists
          if (!sales[itemIdStr]) {
            sales[itemIdStr] = {
              itemId: itemIdStr,
              itemType: order.course ? "course" : order.package ? "package" : "coursePackage",
              itemTitle: order.course ? order.course.title : order.package ? order.package.title : order.coursePackage.title,
              totalSalesMoney: 0,
              ordersCount: 0
            };
          }
          
          // Add to total sales
          sales[itemIdStr].totalSalesMoney += order.totalOrderPrice || 0;
          sales[itemIdStr].ordersCount += 1;
        }
      });
      
      // If we got less than batchSize, we've reached the end
      if (orders.length < batchSize) {
        hasMore = false;
      } else {
        skip += batchSize;
      }
    }
    
    const salesArray = Object.values(sales);
    
    const totalSalesMoney = salesArray.reduce((sum, item) => sum + item.totalSalesMoney, 0);
    const totalOrders = salesArray.reduce((sum, item) => sum + item.ordersCount, 0);
    
    // Add percentage to each item
    const salesWithPercentage = salesArray.map((item) => ({
      ...item,
      percentageOfTotalSales: totalSalesMoney > 0 
        ? parseFloat(((item.totalSalesMoney / totalSalesMoney) * 100).toFixed(2))
        : 0
    }));
    
    // Sort by percentage in descending order
    salesWithPercentage.sort((a, b) => b.percentageOfTotalSales - a.percentageOfTotalSales);
    
    return res.status(200).json({
      status: "success",
      sales: salesWithPercentage,
      totalSalesMoney: totalSalesMoney,
      totalOrders: totalOrders
    });
    
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      status: "failed",
      message: error.message
    });
  }
}