const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const searchController = require("../controllers/search.controller");

const router = express.Router();

router.get(
  "/",
  asyncHandler(searchController.search),
);

module.exports = router;
