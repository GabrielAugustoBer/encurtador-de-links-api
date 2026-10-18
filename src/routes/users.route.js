const express = require("express");
const usersController = require("../controllers/users.controller");

module.exports = function createUsersRouter(db) {
	const router = express.Router();
	const controller = usersController(db);

	router.post("/createUser", controller.createUser);
	router.get("/all-users", controller.getAllUsers);

	return router;
};
