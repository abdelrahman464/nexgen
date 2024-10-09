const Contact = require("../models/contactModel");
const factory = require("./handllerFactory");

//@desc get list of contactInfo
//@route GET /api/v1/contactInfo
//@access private
exports.getAll = factory.getALl(Contact, "Contact");

//@desc get specific contactInfo by id
//@route GET /api/v1/contactInfo/:id
//@access private
exports.getOne = factory.getOne(Contact);

//@desc create contactInfo
//@route POST /api/v1/contactInfo
//@access protected
exports.create = factory.createOne(Contact);

//@desc delete contactInfo
//@route DELETE /api/v1/contactInfo/:id
//@access private
exports.delete = factory.deleteOne(Contact);
