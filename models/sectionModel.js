// database
const mongoose = require('mongoose');
//1- create schema
const sectionSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'section title required'],
      minlength: [3, 'too short category  title '],
      i18n: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
  },
  { timestamps: true },
);

//2- create model
module.exports = mongoose.model('Section', sectionSchema);
