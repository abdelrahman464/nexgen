exports.getOriginalObjects = (document) => {
  const translatedFields = {};
  const { title, description, highlights, content } = document;
  
  if (title) {
    translatedFields.translationTitle = title;
  }
  if (description) {
    translatedFields.translationDescription = description;
  }
  if (highlights) {
    translatedFields.translationHighlights = highlights;
  }
  if (content) {
    translatedFields.translationContent = content;
  }

  return translatedFields;
};
