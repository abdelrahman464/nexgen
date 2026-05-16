const nodemailer = require("nodemailer");
const ApiError = require("./apiError");

const CLIENT_EMAIL_ERROR_MESSAGE =
  "We couldn't send the email right now. Please try again later.";

const requiredEmailEnv = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
  "EMAIL_FROM",
];

const maskEmail = (email) => {
  if (!email || typeof email !== "string") return email;

  const [name, domain] = email.split("@");
  if (!domain) return "***";

  return `${name.slice(0, 2)}***@${domain}`;
};

const createEmailError = (internalMessage, details = null) => {
  const error = new ApiError(CLIENT_EMAIL_ERROR_MESSAGE, 503);

  error.internalMessage = internalMessage;
  error.details = details;

  return error;
};

const getEmailConfig = () => {
  const missing = requiredEmailEnv.filter((key) => !process.env[key]);

  if (missing.length) {
    const details = {
      missing,
      hostConfigured: Boolean(process.env.EMAIL_HOST),
      portConfigured: Boolean(process.env.EMAIL_PORT),
      userConfigured: Boolean(process.env.EMAIL_USER),
      passwordConfigured: Boolean(process.env.EMAIL_PASSWORD),
      fromConfigured: Boolean(process.env.EMAIL_FROM),
    };

    console.error("[email] Missing SMTP configuration", details);

    throw createEmailError(
      `Missing SMTP configuration: ${missing.join(", ")}`,
      details
    );
  }

  const port = Number(process.env.EMAIL_PORT);

  return {
    host: process.env.EMAIL_HOST,
    port,
    secure:
      process.env.EMAIL_SECURE === "true" ||
      (!process.env.EMAIL_SECURE && port === 465),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    sender: {
      name: process.env.EMAIL_FROM,
    },
  };
};

const isAuthError = (err) =>
  err &&
  (err.code === "EAUTH" ||
    err.responseCode === 535 ||
    /Invalid login|authentication failed/i.test(err.message || "") ||
    /Invalid login|authentication failed/i.test(err.response || ""));

const logEmailError = (err, options, config) => {
  const details = {
    to: maskEmail(options.to),
    subject: options.subject,
    host: config.host,
    port: config.port,
    secure: config.secure,
    from: process.env.EMAIL_FROM,
    user: maskEmail(process.env.EMAIL_USER),
    code: err.code,
    command: err.command,
    responseCode: err.responseCode,
    response: err.response,
    message: err.message,
  };

  console.error("[email] Failed to send email", details);

  return details;
};

const sendEmail = async (options) => {
  const emailConfig = getEmailConfig();

  // 1- create transporter
  const transporter = nodemailer.createTransport(emailConfig);

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
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    const details = logEmailError(err, options, emailConfig);

    if (isAuthError(err)) {
      throw createEmailError(
        `SMTP authentication failed: ${err.message}`,
        details
      );
    }

    throw createEmailError(`SMTP send failed: ${err.message}`, details);
  }
};

module.exports = sendEmail;
