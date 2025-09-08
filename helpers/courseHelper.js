const Course = require("../models/courseModel");

const requiredFields = [
  "title",
  "description",
  "highlights",
  "category",
  "instructor",
  "price",
  "image",
  "courseDuration",
  "instructorPercentage",
];

exports.checkIfCourseHasAllFields = async (courseDoc, fields) => {
  const missedFields = [];
  const course = [...fields, ...courseDoc];
  // eslint-disable-next-line no-restricted-syntax
  for (const field of requiredFields) {
    if (!course[field]) {
      missedFields.push(field);
    }
  }
  return missedFields;
};
