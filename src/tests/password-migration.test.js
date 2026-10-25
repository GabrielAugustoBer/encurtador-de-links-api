const bcrypt = require("bcryptjs");
const migratePlaintextPasswords = require("../../scripts/migrate-plaintext-passwords");

function createPool(queryResults) {
	const client = {
		query: jest.fn(),
		release: jest.fn(),
	};
	for (const result of queryResults) {
		client.query.mockResolvedValueOnce(result);
	}
	return {
		client,
		pool: { connect: jest.fn().mockResolvedValue(client) },
	};
}

describe("Migração de senhas em texto puro", () => {
	test("gera hashes bcrypt e remove a coluna antiga em uma transação", async () => {
		const { client, pool } = createPool([
			{},
			{ rows: [{ exists: true }] },
			{},
			{ rows: [{ id: 5, senha: "senha-antiga-segura" }] },
			{ rows: [] },
			{ rows: [] },
			{ rows: [] },
			{ rows: [] },
		]);

		const result = await migratePlaintextPasswords(pool);

		expect(result).toEqual({ migrated: true, accounts: 1 });
		const updateCall = client.query.mock.calls.find(([sql]) =>
			sql.includes("UPDATE users SET password_hash"),
		);
		expect(await bcrypt.compare("senha-antiga-segura", updateCall[1][0])).toBe(
			true,
		);
		expect(client.query).toHaveBeenCalledWith(
			"ALTER TABLE users DROP COLUMN senha",
		);
		expect(client.query).toHaveBeenLastCalledWith("COMMIT");
		expect(client.release).toHaveBeenCalledTimes(1);
	});

	test("não altera o banco quando a coluna antiga não existe", async () => {
		const { client, pool } = createPool([
			{},
			{ rows: [{ exists: false }] },
			{},
		]);

		const result = await migratePlaintextPasswords(pool);

		expect(result).toEqual({ migrated: false, accounts: 0 });
		expect(client.query).toHaveBeenLastCalledWith("COMMIT");
		expect(client.query).not.toHaveBeenCalledWith(
			"ALTER TABLE users DROP COLUMN senha",
		);
	});

	test("cancela a migração se uma senha exceder o limite suportado", async () => {
		const { client, pool } = createPool([
			{},
			{ rows: [{ exists: true }] },
			{},
			{ rows: [{ id: 7, senha: "s".repeat(73) }] },
			{},
		]);

		await expect(migratePlaintextPasswords(pool)).rejects.toThrow(
			"A conta 7 tem uma senha incompatível",
		);
		expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
		expect(client.query).not.toHaveBeenCalledWith(
			"ALTER TABLE users DROP COLUMN senha",
		);
		expect(client.release).toHaveBeenCalledTimes(1);
	});
});
