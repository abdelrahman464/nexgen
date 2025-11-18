const requiredFields = [
  "title",
  "description",
  "price",
  "courses",
  "image",
];

exports.checkIfCoursePackageHasAllFields = async (coursePackageDoc, fields) => {
  const missedFields = [];
  const coursePackage = { ...coursePackageDoc, ...fields };
  // eslint-disable-next-line no-restricted-syntax
  for (const field of requiredFields) {
    if (field === "courses") {
      // Special check for courses array - must be an array with at least one element
      if (!Array.isArray(coursePackage[field]) || coursePackage[field].length === 0) {
        missedFields.push(field);
      }
    } else if (!coursePackage[field]) {
      missedFields.push(field);
    }
  }
  return missedFields;
};

