const axios = require("axios");

async function verifyEmailWithMailboxLayer(email) {

  try {
    const response = await axios.get(
      `http://apilayer.net/api/check?access_key=${process.env.accessKey}&email=${email}`
    );

    if (response.data.smtp_check === true) {
      return true;
    } 
      return false;
    
  } catch (error) {
    console.error("Error during email verification:", error);
    return false;
  }
}

module.exports = verifyEmailWithMailboxLayer;