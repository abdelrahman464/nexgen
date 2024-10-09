const InstructorProfit = require('../models/instructorProfitsModel');
const ApiError = require('../utils/apiError');
//-----------------------------------------------------
exports.createOne = async (instructorId) => {
  // eslint-disable-next-line no-useless-catch
  try {
    //1- check if this instructor has a profit object
    const instructorProfit = await InstructorProfit.findOne({
      instructor: instructorId,
    });
    if (instructorProfit) {
      return true;
    }
    //2- if not create one
    await InstructorProfit.create({ instructor: instructorId });
    return true;
  } catch (err) {
    throw err;
  }
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
  const instructorProfits = await InstructorProfit.findOne({
    instructor: instructorId,
  });
  //2- check if instructor profits found
  if (!instructorProfits) {
    throw new ApiError('No instructor profits found', 404);
  }
  //3- check if user has money to be calculated
  if (instructorProfits.profits.length <= 0) {
    throw new ApiError('No profits found to be calculated', 404);
  }
  //4-calculate the profits
  let profits;
  if (instructorProfits.profits && instructorProfits.profits.length !== 0) {
    profits = instructorProfits.profits.reduce(
      (total, profitObject) => total + profitObject.profit,
      0,
    );
  }

  //5- calculate start point date of this invoice
  const startPointDate =
    instructorProfits.invoices && instructorProfits.invoices.length > 0
      ? instructorProfits.invoices[instructorProfits.invoices.length - 1]
          .createdAt
      : instructorProfits.createdAt;

  //6- push the invoice
  instructorProfits.invoices.push({
    profits,
    desc: `wallet Invoice for period : ${startPointDate.toLocaleString(
      'default',
      {
        month: 'long',
      },
    )} ${startPointDate.getDate()} (${startPointDate.toLocaleString('en-US', {
      weekday: 'long',
    })}) to  ${new Date().toLocaleString('default', {
      month: 'long',
    })} ${new Date().getDate()} (${new Date().toLocaleString('en-US', {
      weekday: 'long',
    })})`,
    paymentMethod: reqBody.paymentMethod,
    receiverAcc: reqBody.receiverAcc,
  });
  //7- reset the profits array
  instructorProfits.profits = [];
  //8- save the invoice
  await instructorProfits.save();
  //9- return success
  return {
    statusCode: 200,
    response: {
      status: 'success',
      msg: `instructorProfits Invoice created successfully`,
    },
  };
};
//---------------------------------------------------
//@desc : get all instructor profits invoices
//@usage: ./marketingInvoicesService.js => getAllRequestedInvoices
exports.getInstructorProfitsInvoices = async (status) => {
  const instructorProfitsInvoices = await InstructorProfit.find({
    'invoices.status': status,
  }).populate('instructor', 'name email profileImg');
  //check if no invoices found
  if (instructorProfitsInvoices.length === 0) {
    throw new ApiError(`No invoices with status ${status}`, 404);
  }
  // Filter only the invoices with the specified status
  const invoices = instructorProfitsInvoices.map((log) => ({
    _id: log._id,
    role: 'instructor',
    marketer: log.instructor,
    invoices: log.invoices.filter((invoice) => invoice.status === status),
  }));
  //send the response
  return {
    status: 'success',
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
    'invoices._id': invoiceId,
  });
  //2- check if invoice found
  if (!instructorProfitsObject) {
    throw new ApiError('No invoices found', 404);
  }
  //3- update the invoice status
  instructorProfitsObject.invoices.id(invoiceId).status = status;
  //4- save the invoice
  await instructorProfitsObject.save();
  //5- return success
  return true;
};
//---------------------------------------------------
