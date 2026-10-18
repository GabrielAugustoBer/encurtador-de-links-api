const express = require("express");
const usersController = require("../controllers/users.controller");
const createUsersRepository = require("../repositories/users.repository");
const usersService = require("../services/users.services");

module.exports = function createUsersRouter(db) {
	const router = express.Router();
	const repository = createUsersRepository(db);
	const service = usersService(repository);
	const controller = usersController(service);

	router.post("/createUser", controller.createUser);
	router.get("/all-users", controller.getAllUsers);

	return router;
};
