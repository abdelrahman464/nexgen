// database
const mongoose = require('mongoose');
//1- create schema
const categorySchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'category title required'],
      unique: [true, 'category title must be unique'],
      minlength: [3, 'too short category title'],
      i18n: true,
    },
  },
  { timestamps: true },
);

//2- create model
const CategoryModel = mongoose.model('Category', categorySchema);

module.exports = CategoryModel;
