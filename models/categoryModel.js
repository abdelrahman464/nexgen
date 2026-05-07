// database
const mongoose = require('mongoose');
//1- create schema
const categorySchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'category title required'],
      minlength: [3, 'too short category title'],
      i18n: true,
    },
    image: {
      type: String,
    },
  },
  { timestamps: true },
);
const setImageURL = (doc) => {
  //return image base url + iamge name
  if (doc.image) {
    const ImageUrl = `${process.env.BASE_URL}/categories/${doc.image}`;
    doc.image = ImageUrl;
  }
};
//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
categorySchema.post("init", (doc) => {
  setImageURL(doc);
});
// it work with create
categorySchema.post("save", (doc) => {
  setImageURL(doc);
});
//2- create model
const CategoryModel =
  mongoose.models.Category || mongoose.model('Category', categorySchema);

module.exports = CategoryModel;
