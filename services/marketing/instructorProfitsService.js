const InstructorProfit = require("../../models/instructorProfitsModel");
const ApiError = require("../../utils/apiError");
const Course = require("../../models/courseModel");
const Order = require("../../models/orderModel");
const Package = require("../../models/packageModel");
const CoursePackage = require("../../models/coursePackageModel");
const User = require("../../models/userModel");
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
  if (amount > instructorProfits.profits) {
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
  });

  instructorProfits.profits -= amount;
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
exports.giveInstructorHisCommission = async (data, profit) => {
  try {
    console.log("giving instructor percentage");
    // const profit = (data.amount * data.instructorPercentage) / 100;
    await InstructorProfit.findOneAndUpdate(
      { instructor: data.instructorId },
      {
        $inc: {
          profits: profit,
          totalSalesMoney: data.amount,
        },
        $push: {
          commissions: {
            order: data.order,
            type: data.itemType,
            amount: data.amount,
            marketerPercentage: data.marketerPercentage,
            marketerProfits: data.marketerProfits,
            percentage: data.instructorPercentage,
            profit,
            createdAt: new Date(),
          },
        },
      }
    );
    await Order.findOneAndUpdate(
      { _id: data.order },
      {
        instructorPercentage: data.instructorPercentage,
        instructorProfits: profit,
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
          _id: order.user._id,
          name: order.user.name,
          email: order.user.email,
          profileImg: order.user.profileImg,
          isResale: order.isResale || false,
          paidAt: order.paidAt,
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
