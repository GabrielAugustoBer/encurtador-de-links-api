const express = require("express");
const shortenController = require("../controllers/shorten.controller");

module.exports = function createShortenRouter(db) {
	const router = express.Router();
	const controller = shortenController(db)

	router.post("/createShorten", controller.createShorten);
	router.get("/allShorten", controller.allShorten);
	router.get("/:shortCode", controller.redirectShort);
	router.get("/:shortCode/stats", controller.statsShort);
	router.delete("/links/:shortCode/delete", controller.deleteShort);

	return router;
};
