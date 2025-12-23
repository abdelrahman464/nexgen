const path = require("path");
const express = require("express");
//i18n
const i18n = require("i18n");

const mongoose = require("mongoose");
//middleware
const morgan = require("morgan");
//env file
const cors = require("cors");
const compression = require("compression");
const dotenv = require("dotenv");

const { logErrorToDatabase } = require("./utils/errorLogs");
// const rateLimit = require("express-rate-limit");

dotenv.config({ path: "config.env" });

// Set up i18n
i18n.configure({
  locales: [process.env.FIRST_LANGUAGE, process.env.SECOND_LANGUAGE],
  directory: `${__dirname}/locales`,
  defaultLocale: process.env.FIRST_LANGUAGE || "ar",
  objectNotation: true,
  header: "Accept-Language", // Use the Accept-Language header for locale detection
});

const localeMiddleware = require("./middlewares/localeMiddleware");
//database
const dbConnection = require("./config/database");
//route
const mountRoutes = require("./routes");

//error class that i made in utils to handle operational error
const ApiError = require("./utils/apiError");
//GLobal error handling middleware for express
const globalError = require("./middlewares/errorMiddleware");

//connect with database
dbConnection();
mongoose.set("strictQuery", false);
//express app
const app = express();
//enable other domains access your application
app.use(cors());
app.options("*", cors());

//i18n middleware
app.use(i18n.init);
app.use(localeMiddleware);

// compress all responses
app.use(compression());

//middlewares
//parsing the coming data to json
// app.use(
//   express.json({
//     limit: "1000kp",
//   })
// );

// Middleware to parse application/x-www-form-urlencoded
app.use(
  express.urlencoded({
    extended: true,
    limit: "1000kb",
  })
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
//serve static files inside 'uploads'
app.use(express.static(path.join(__dirname, "uploads")));

// Swagger UI setup
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "NexGen Pro API Documentation",
  })
);

// Serve Swagger JSON
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
  console.log(process.env.NODE_ENV);
}

// Limit each IP to 100 requests per `window` (here, per 15 minutes)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 1000,
//   message:
//     "Too many requests created from this IP, please try again after an 15minute interval",
// });
// // Apply the rate limiting middleware to all requests
// app.use("/api", limiter);

// Mount Routes
mountRoutes(app);

//if there is a problem with routes
// catch the wrong routes that i never Mount
app.all("*", (req, res, next) => {
  //create error and send it to error handling middleware
  next(new ApiError(`Cant Find This Route ${req.originalUrl}`, 400));
});

app.use(globalError);

const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log(`app running on ${PORT}`);
});

// Initialize Socket.IO server and integrate with Express
const { initSocket } = require("./socket/index");

initSocket(server);

//schedule the cron job
const { cronJobs } = require("./utils/cronJob/automatedTasks");

// cronJobs();

// invoicesCronJob();
//handle Rejection out side express
//Events =>list =>callback(err)
process.on("unhandledRejection", async (err) => {
  console.error(
    `UnhandledRejection Errors :${err.name} | ${err.message} | ${err.stack}`
  );

  try {
    // Log the error to the database
    await logErrorToDatabase(err);

    // Close the server and exit the process after logging
    server.close(() => {
      console.log("Shutting Down.....");
      process.exit(1);
    });
  } catch (dbError) {
    console.error("Failed to log error to database:", dbError);
    // If logging to the database fails, still shut down the server
    server.close(() => {
      console.log("Shutting Down.....");
      process.exit(1);
    });
  }
});
