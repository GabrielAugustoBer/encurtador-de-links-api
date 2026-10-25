const express = require("express");
const usersController = require("../controllers/users.controller");
const createUsersRepository = require("../repositories/users.repository");
const usersService = require("../services/users.services");
const createAuthRepository = require("../repositories/auth.repository");
const createAuthService = require("../services/auth.services");
const createAuthMiddleware = require("../middlewares/auth.middleware");
const createAuthRateLimit = require("../middlewares/auth-rate-limit.middleware");
const requireRole = require("../middlewares/require-role.middleware");
const AppError = require("../errors/app-error");

module.exports = function createUsersRouter(db, { jwtSecret, authMiddleware }) {
	const router = express.Router();
	const repository = createUsersRepository(db);
	const service = usersService(repository);
	const controller = usersController(service);
	const authRepository = createAuthRepository(db);
	const authenticate =
		authMiddleware ?? createAuthMiddleware(authRepository, jwtSecret);
	const authService = createAuthService(repository, authRepository, jwtSecret);
	const authRateLimit = createAuthRateLimit();

	router.post("/createUser", authRateLimit, controller.createUser);
	router.post("/login", authRateLimit, async (req, res) => {
		try {
			const { email, senha } = req.body ?? {};
			return res.status(200).json(await authService.login(email, senha));
		} catch (error) {
			if (error instanceof AppError) {
				return res.status(error.statusCode).json({ error: error.message });
			}
			console.error(error);
			return res.status(500).json({ error: "Erro interno no servidor" });
		}
	});
	router.post("/logout", authenticate, async (req, res) => {
		try {
			await authService.logout(req.auth.tokenId, req.auth.expiresAt);
			return res.status(200).json({ message: "Logout realizado com sucesso" });
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: "Erro interno no servidor" });
		}
	});
	router.get("/me", authenticate, controller.getMe);
	router.patch("/me", authenticate, controller.updateMe);
	router.get(
		"/all-users",
		authenticate,
		requireRole("admin"),
		controller.getAllUsers,
	);

	return router;
};
