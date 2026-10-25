const bcrypt = require("bcryptjs");

const PASSWORD_HASH_ROUNDS = 12;

async function migratePlaintextPasswords(pool) {
	const client = await pool.connect();

	try {
		await client.query("BEGIN");
		const columnResult = await client.query(
			`SELECT EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = current_schema()
					AND table_name = 'users'
					AND column_name = 'senha'
			) AS exists`,
		);
		if (!columnResult.rows[0].exists) {
			await client.query("COMMIT");
			return { migrated: false, accounts: 0 };
		}

		await client.query(
			"ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT",
		);
		const usersResult = await client.query(
			"SELECT id, senha FROM users WHERE senha IS NOT NULL FOR UPDATE",
		);

		for (const user of usersResult.rows) {
			if (
				typeof user.senha !== "string" ||
				Buffer.byteLength(user.senha, "utf8") > 72
			) {
				throw new Error(
					`A conta ${user.id} tem uma senha incompatível; redefina-a antes da migração`,
				);
			}
			const passwordHash = await bcrypt.hash(user.senha, PASSWORD_HASH_ROUNDS);
			await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
				passwordHash,
				user.id,
			]);
		}

		await client.query("ALTER TABLE users DROP COLUMN senha");
		await client.query("COMMIT");
		return { migrated: true, accounts: usersResult.rows.length };
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}

if (require.main === module) {
	require("dotenv").config();
	const { Pool } = require("pg");

	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL é obrigatória para a migração");
	}

	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		ssl: { rejectUnauthorized: true },
	});

	migratePlaintextPasswords(pool)
		.then(({ migrated, accounts }) => {
			console.log(
				migrated
					? `Senhas migradas com hash para ${accounts} conta(s).`
					: "Nenhuma coluna de senha em texto puro encontrada.",
			);
		})
		.catch((error) => {
			console.error("Falha ao migrar senhas:", error.message);
			process.exitCode = 1;
		})
		.finally(() => pool.end());
}

module.exports = migratePlaintextPasswords;
