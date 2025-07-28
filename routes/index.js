const authRoute = require("./authRoute");
const userRoute = require("./userRoute");
const categoryRoute = require("./categoryRoute");
const courseRoute = require("./courseRoute");
const lessonRoute = require("./lessonRoute");
const sectionRoute = require("./sectionRoute");
const reviewRoute = require("./reviewRoute");
const wishlistRoute = require("./wishlistRoute");
const orderRoute = require("./OrderRoute");
const articalRoute = require("./articalRoute");
const examRoute = require("./examRoute");
const userSubscriptionRoute = require("./userSubscriptionRoute");
const packageRoute = require("./packageRoute");
const PostRoute = require("./postRoute");
const CommentRoute = require("./commentRoute");
const ReactRoute = require("./reqctionRoute");
const coursePackageRoute = require("./coursePackageRoute");
const liveRoute = require("./liveRoute");
const ChatRoute = require("./ChatRoute");
const MessageRoute = require("./MessageRoute");
const notificationRoute = require("./notificationRoute");
const marketingRoute = require("./marketingRoute");
const contactRoute = require("./contactRoute");
const systemReviewRoute = require("./systemReviewRoute");
const analyticsRoute = require("./analyticRoute");
const eventRoute = require("./eventRoute");
const marketingInvoicesRoute = require("./invoicesReqsRoute");
const couponRoute = require("./couponRoute");
const marketerRateingRoute = require("./marketerRatingRoute");
const leaderBoardRoute = require("./leaderBoardRoute");
const contactUsRoute = require("./contactUsRoute");
const marketingAnalytics = require("./marketingAnalyticsRoute");

const mountRoutes = (app) => {
  // Mount Routes
  app.use("/api/v1/auth", authRoute);
  app.use("/api/v1/users", userRoute);

  app.use("/api/v1/categories", categoryRoute);
  app.use("/api/v1/coursePackages", coursePackageRoute);
  app.use("/api/v1/packages", packageRoute);
  app.use("/api/v1/courses", courseRoute);
  app.use("/api/v1/lessons", lessonRoute);
  app.use("/api/v1/sections", sectionRoute);

  app.use("/api/v1/reviews", reviewRoute);
  app.use("/api/v1/systemReviews", systemReviewRoute);
  app.use("/api/v1/wishlist", wishlistRoute);
  app.use("/api/v1/orders", orderRoute);
  app.use("/api/v1/exams", examRoute);
  app.use("/api/v1/userSubscriptions", userSubscriptionRoute);

  app.use("/api/v1/posts", PostRoute);
  app.use("/api/v1/articals", articalRoute);
  app.use("/api/v1/comments", CommentRoute);
  app.use("/api/v1/reacts", ReactRoute);
  app.use("/api/v1/analytics", analyticsRoute);

  app.use("/api/v1/lives", liveRoute);
  app.use("/api/v1/chats", ChatRoute);
  app.use("/api/v1/messages", MessageRoute);
  app.use("/api/v1/notifications", notificationRoute);
  app.use("/api/v1/events", eventRoute);

  app.use("/api/v1/marketing", marketingRoute);
  app.use("/api/v1/marketingInvoices", marketingInvoicesRoute);

  app.use("/api/v1/contactInfo", contactRoute);

  app.use("/api/v1/analytics", analyticsRoute);

  app.use("/api/v1/systemReviews", systemReviewRoute);
  app.use("/api/v1/coupons", couponRoute);
  app.use("/api/v1/marketerRating", marketerRateingRoute);
  app.use("/api/v1/leaderBoard", leaderBoardRoute);

  app.use("/api/v1/marketingAnalytics", marketingAnalytics);
  app.use("/api/v1/contactUs", contactUsRoute);
};
module.exports = mountRoutes;
