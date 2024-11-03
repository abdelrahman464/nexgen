const express = require("express");

const leaderBoardController = require("../services/leaderBoardService");

const router = express.Router();

router.route("/").get(leaderBoardController.getLeaderBoard);

module.exports = router;
