const requiredFields = [
  "title",
  "description",
  "highlights",
  "category",
  "instructor",
  "price",
  "image",
  "courseDuration",
];

exports.checkIfCourseHasAllFields = async (courseDoc, fields) => {
  const missedFields = [];
  const course = { ...courseDoc, ...fields };
  // eslint-disable-next-line no-restricted-syntax
  for (const field of requiredFields) {
    if (!course[field]) {
      missedFields.push(field);
    }
  }
  return missedFields;
};

//-----------------
exports.getLastLessonOrderNumber = async (lessons) => {
  let lastOrderNumber = 0;
  lessons.forEach((lesson) => {
    console.log("lesson.order", lesson.order);
    if (lesson.order > lastOrderNumber) {
      lastOrderNumber = lesson.order;
    }
  });
  lastOrderNumber += 1;
  return lastOrderNumber;
};
