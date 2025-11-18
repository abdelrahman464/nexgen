const requiredFields = [
  "title",
  "description",
  "course",
  "instructor",
  "price",
  "subscriptionDurationDays",
  "image",
];

exports.checkIfPackageHasAllFields = async (packageDoc, fields) => {
  const missedFields = [];
  const package = { ...packageDoc, ...fields };
  // eslint-disable-next-line no-restricted-syntax
  for (const field of requiredFields) {
    if (!package[field]) {
      missedFields.push(field);
    }
  }
  return missedFields;
};

