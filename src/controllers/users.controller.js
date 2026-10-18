module.exports = function usersController(usersService) {
	return {
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
				const { name, email } = req.body;
				const user = await usersService.create(name, email);
				return res.status(201).json(user);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
	};
};
