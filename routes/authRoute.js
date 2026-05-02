const express = require("express");
const passport = require("passport");

const {
  signupValidator,
  loginValidator,
  adminIssueUserTokenValidator,
} = require("../utils/validators/authValidator");
const {
  protect,
  allowedTo,
  signup,
  login,
  forgotPassword,
  verifyPassResetCode,
  resetPassword,
  resendEmailCode,
  verifyEmail,
  getLoggedUserData,
  googleMobileAuth,
  adminIssueUserToken,
} = require("../services/authServices");
const { uploadImages, resizeImage } = require("../services/userService");
//const { cleanUpSubscriptions } = require("../services/marketing/fixBugs");

const router = express.Router();

// Route to start the authentication process
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback route that Google will redirect to after authentication
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }), // Disable sessions
  (req, res) => {
    // Assuming your strategy attaches the JWT to the user object
    if (req.user && req.user.token) {
      // Redirect the user or send the token directly
      // Example: Redirect with the token in query params
      res.redirect(
        `https://nexgen-academy.com/en/callback/google?token=${req.user.token}`
      );
    } else {
      res.redirect("/login?error=authenticationFailed");
    }
  }
);
router
  .route("/signup")
  .post(uploadImages, resizeImage, signupValidator, signup);
router.route("/login").post(loginValidator, login);
// router.route("/login").post(cleanUpSubscriptions);
//password reset
router.route("/forgotPassword").post(forgotPassword);
router.route("/verifyResetCode").post(verifyPassResetCode);
router.route("/resetPassword").put(resetPassword);
//email verification
router.route("/verifyEmail").post(verifyEmail);
router.route("/resendEmailCode").post(resendEmailCode);
router.route("/getMe").get(getLoggedUserData);
router
  .route("/admin/issue-user-token")
  .post(
    protect,
    allowedTo("admin"),
    adminIssueUserTokenValidator,
    adminIssueUserToken
  );

// Mobile Google OAuth endpoint
router.post("/google/mobile", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        status: "error",
        message: "Google ID token is required",
      });
    }

    // Verify the Google ID token and handle user authentication
    const result = await googleMobileAuth(idToken);

    res.status(200).json({
      status: "success",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    res.status(401).json({
      status: "error",
      message: error.message || "Authentication failed",
    });
  }
});

module.exports = router;
