const AppError = require("../errors/app-error");

module.exports = function usersController(usersService) {
	return {
		getMe: async (req, res) => {
			return res.status(200).json({
				id: req.user.id,
				name: req.user.name,
				email: req.user.email,
				role: req.user.role,
			});
		},
		updateMe: async (req, res) => {
			try {
				const user = await usersService.updateProfile(
					req.user.id,
					req.user,
					req.body,
				);
				return res.status(200).json(user);
			} catch (error) {
				if (error instanceof AppError) {
					return res.status(error.statusCode).json({ error: error.message });
				}
				console.error(error);
				return res.status(500).json({ error: "Erro interno no servidor" });
			}
		},
		getAllUsers: async (_req, res) => {
			try {
				const users = await usersService.getAll();
				return res.status(200).json(users);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		createUser: async (req, res) => {
			try {
				const { name, email, senha } = req.body ?? {};
				const user = await usersService.create(name, email, senha);
				return res.status(201).json(user);
			} catch (error) {
				if (error instanceof AppError) {
					return res.status(error.statusCode).json({ error: error.message });
				}
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
	};
};
