// database
const mongoose = require("mongoose");
//1- create schema
const sectionSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "section title required"],
      unique: [true, "section title must be unique"],
      minlength: [3, "too short category  title "],
    },
  },
  { timestamps: true }
);

//2- create model
module.exports = mongoose.model("Section", sectionSchema);
