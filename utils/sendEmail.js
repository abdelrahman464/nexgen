const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // 1- create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    sender: {
      name: process.env.EMAIL_FROM,
    },
  });

  // 2- define email options
  const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM,
      address: process.env.EMAIL_USER,
    },
    to: options.to,
    subject: options.subject,
    html: options.html, // Changed from text to html
  };

  // 3- send email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;