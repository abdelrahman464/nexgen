// database
const mongoose = require('mongoose');
//1- create schema
const eventSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'event title required'],
      minlength: [3, 'too short event title'],
      i18n: true,
    },
    description: {
      type: String,
      minlength: [3, 'too short event description'],
      i18n: true,
    },
    date: {
      type: Date,
    },
    link: {
      type: String,
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
    const ImageUrl = `${process.env.BASE_URL}/events/${doc.image}`;
    doc.image = ImageUrl;
  }
};

eventSchema.post('init', (doc) => {
  setImageURL(doc);
});
// it work with create
eventSchema.post('save', (doc) => {
  setImageURL(doc);
});
//2- create model
module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema);
