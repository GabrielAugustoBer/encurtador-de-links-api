const bcrypt = require("bcryptjs");
const AppError = require("../errors/app-error");

const PASSWORD_HASH_ROUNDS = 12;

module.exports = function usersService(usersRepository) {
	return {
		getAll: () => usersRepository.findAll(),
		updateProfile: async (id, currentUser, changes) => {
			if (
				!changes ||
				typeof changes !== "object" ||
				Array.isArray(changes) ||
				(!Object.hasOwn(changes, "name") && !Object.hasOwn(changes, "email")) ||
				Object.keys(changes).some((key) => !["name", "email"].includes(key))
			) {
				throw new AppError(400, "Dados de perfil inválidos");
			}

			const name = changes.name ?? currentUser.name;
			const email = changes.email ?? currentUser.email;
			if (
				typeof name !== "string" ||
				name.trim().length === 0 ||
				name.trim().length > 100 ||
				typeof email !== "string" ||
				email.trim().length > 254 ||
				!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
			) {
				throw new AppError(400, "Dados de perfil inválidos");
			}

			try {
				const updated = await usersRepository.updateProfile(
					id,
					name.trim(),
					email.trim().toLowerCase(),
				);
				if (!updated) {
					throw new AppError(404, "Usuário não encontrado");
				}
				return updated;
			} catch (error) {
				if (error.code === "23505") {
					throw new AppError(409, "E-mail já cadastrado");
				}
				throw error;
			}
		},
		create: async (name, email, senha) => {
			if (
				typeof name !== "string" ||
				name.trim().length === 0 ||
				name.trim().length > 100 ||
				typeof email !== "string" ||
				email.trim().length > 254 ||
				!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
				typeof senha !== "string" ||
				senha.length < 12 ||
				Buffer.byteLength(senha, "utf8") > 72
			) {
				throw new AppError(400, "Dados de cadastro inválidos");
			}

			const normalizedEmail = email.trim().toLowerCase();
			const passwordHash = await bcrypt.hash(senha, PASSWORD_HASH_ROUNDS);

			try {
				return await usersRepository.create(
					name.trim(),
					normalizedEmail,
					passwordHash,
				);
			} catch (error) {
				if (error.code === "23505") {
					throw new AppError(409, "E-mail já cadastrado");
				}
				throw error;
			}
		},
	};
};
