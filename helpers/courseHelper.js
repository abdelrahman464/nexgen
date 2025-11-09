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
    if (lesson.order > lastOrderNumber) {
      lastOrderNumber = lesson.order;
    }
  });
  lastOrderNumber += 1;
  return lastOrderNumber;
};
//--------------------
exports.addTranslationFields = (document, localizedResult) => {
  localizedResult.translationTitle = document.title;
  if (document.description) {
    localizedResult.translationDescription = document.description;
  }
  if (document.highlights) {
    localizedResult.translationHighlights = document.highlights;
  }
  if (document.content) {
    localizedResult.translationContent = document.content;
  }
  if (document.assignmentTitle) {
    localizedResult.translationAssignmentTitle = document.assignmentTitle;
  }
  if (document.assignmentDescription) {
    localizedResult.translationAssignmentDescription =
      document.assignmentDescription;
  }
  if (document.metaTitle) {
    localizedResult.translationMetaTitle = document.metaTitle;
  }
  if (document.metaDescription) {
    localizedResult.translationMetaDescription = document.metaDescription;
  }
  if (document.keywords) {
    localizedResult.translationKeywords = document.keywords;
  }
  if (document.whatWillLearn) {
    localizedResult.translationWhatWillLearn = document.whatWillLearn;
  }
  if (document.coursePrerequisites) {
    localizedResult.translationCoursePrerequisites =
      document.coursePrerequisites;
  }
  if (document.whoThisCourseFor) {
    localizedResult.translationWhoThisCourseFor = document.whoThisCourseFor;
  }
  if (document.goodByeMessage) {
    localizedResult.translationGoodByeMessage = document.goodByeMessage;
  }
  if (document.courseWelcomeMessage) {
    localizedResult.translationCourseWelcomeMessage =
      document.courseWelcomeMessage;
  }
  return localizedResult;
};
