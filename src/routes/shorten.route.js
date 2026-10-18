const express = require("express");
const shortenController = require("../controllers/shorten.controller");
const createLinksRepository = require("../repositories/links.repository");
const createShortenService = require("../services/shorten.services");

module.exports = function createShortenRouter(db) {
	const router = express.Router();
	const linksRepository = createLinksRepository(db);
	const service = createShortenService(linksRepository);
	const controller = shortenController(service);

	router.post("/createShorten", controller.createShorten);
	router.get("/allShorten", controller.allShorten);
	router.get("/:shortCode", controller.redirectShort);
	router.get("/:shortCode/stats", controller.statsShort);
	router.delete("/links/:shortCode/delete", controller.deleteShort);

	return router;
};
