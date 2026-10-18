module.exports = function usersService(usersRepository) {
	return {
		getAll: () => usersRepository.findAll(),
		create: async (name, email) => {
			await usersRepository.create(name, email);
			return { name, email };
		},
	};
};
