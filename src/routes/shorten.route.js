const express = require("express");
const shortenController = require("../controllers/shorten.controller");
const createLinksRepository = require("../repositories/links.repository");
const createShortenService = require("../services/shorten.services");

module.exports = function createShortenRouter(
	db,
	authMiddleware,
	geoLocate = async () => null,
) {
	const router = express.Router();
	const linksRepository = createLinksRepository(db);
	const service = createShortenService(linksRepository, geoLocate);
	const controller = shortenController(service);

	router.post("/createShorten", authMiddleware, controller.createShorten);
	router.get("/allShorten", authMiddleware, controller.allShorten);
	router.get(
		"/links/:shortCode/analytics",
		authMiddleware,
		controller.analytics,
	);
	router.get(
		"/links/:shortCode/analytics/countries",
		authMiddleware,
		controller.analyticsCountries,
	);
	router.get(
		"/links/:shortCode/analytics/timeseries",
		authMiddleware,
		controller.analyticsTimeseries,
	);
	router.patch(
		"/links/:shortCode/settings",
		authMiddleware,
		controller.updateSettings,
	);
	router.post("/links/:shortCode/disable", authMiddleware, (req, res) =>
		controller.setActive(req, res, false),
	);
	router.post("/links/:shortCode/enable", authMiddleware, (req, res) =>
		controller.setActive(req, res, true),
	);
	router.get("/links/:shortCode", authMiddleware, controller.getShorten);
	router.patch("/links/:shortCode", authMiddleware, controller.updateShorten);
	router.delete("/links/:shortCode", authMiddleware, controller.deleteShort);
	router.get("/:shortCode", controller.redirectShort);
	router.get("/:shortCode/stats", authMiddleware, controller.statsShort);
	router.delete(
		"/links/:shortCode/delete",
		authMiddleware,
		controller.deleteShort,
	);

	return router;
};
