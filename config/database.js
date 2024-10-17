// database
const mongoose = require('mongoose');
const mongooseI18nLocalize = require('mongoose-i18n-localize');

// Global plugin for localization
mongoose.plugin(mongooseI18nLocalize, {
  locales: [process.env.FIRST_LANGUAGE, process.env.SECOND_LANGUAGE], // Adjust this array to include all your supported locales
});
//connect with db
const dbConnection = () => {
  mongoose
    .connect(process.env.DB_URI)
    .then((conn) => {
      console.log(`Database Connected : ${conn.connection.host}`);
    })
    .catch((err) => {
      console.error(`Database Error : ${err}`);
      process.exit(1);
    });
};

module.exports = dbConnection;
