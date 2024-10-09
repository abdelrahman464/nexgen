const mongoose = require("mongoose");

const MarketingRequestsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    fullName: {
      type: String,
    },
    country: {
      type: String,
    },
    city: {
      type: String,
    },
    birthDate: {
      type: Date,
    },
    currentWork: {
      type: String,
    },
    ansOfQuestion: {
      type: String,
    },
    instagram: {
      type: String,
    },
    tiktok: {
      type: String,
    },
    telegram: {
      type: String,
    },
    cv: {
      //pdf uploading
      type: String,
    },
    // identity: {
    //   //pdf uploading
    //   type: String,
    // },
    paymentMethod: {
      //image uploading
      type: String,
      Enum: ["wise", "crypto"],
    },
    status: {
      type: String,
      enum: ["accepted", "rejected", "pending"],
      default: "pending",
    },
  },
  { timestamps: true }
);

MarketingRequestsSchema.pre(/^find/, function (next) {
  // this => query
  this.populate({ path: "user", select: "name email profileImg" });
  next();
});
//----------------------------------------------------------------
const setImageURL = (doc) => {
  if (doc.cv) {
    doc.cv = `${process.env.BASE_URL}/marketing/cv/${doc.cv}`;
  }
};
//after initializ the doc in db
// check if the document contains image
// it work with findOne,findAll,update
MarketingRequestsSchema.post("init", (doc) => {
  setImageURL(doc);
});
// it work with create
MarketingRequestsSchema.post("save", (doc) => {
  setImageURL(doc);
});

const MarketingRequests = mongoose.model(
  "MarketingRequests",
  MarketingRequestsSchema
);

module.exports = MarketingRequests;
