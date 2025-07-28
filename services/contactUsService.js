const factory = require("./handllerFactory");
const ContactUs = require("../models/contactUsModel");

exports.createContactUs = factory.createOne(ContactUs);


exports.getAllContactUs = factory.getALl(ContactUs);
