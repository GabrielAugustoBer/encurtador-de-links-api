const AppError = require("../errors/app-error");

function createAnalyticsHandler(getAnalytics) {
	return async (req, res) => {
		try {
			const result = await getAnalytics(
				req.params.shortCode,
				req.user.id,
				req.query.from,
				req.query.to,
			);
			if (!result) {
				return res.status(404).json({ error: "Link não encontrado" });
			}
			return res.status(200).json(result);
		} catch (error) {
			if (error instanceof AppError) {
				return res.status(error.statusCode).json({ error: error.message });
			}
			console.error(error);
			return res.status(500).json({ error: "Erro interno no servidor" });
		}
	};
}

module.exports = function shortenController(shortenService) {
	return {
		allShorten: async (req, res) => {
			try {
				const links = await shortenService.allShorten(req.user.id);
				return res.status(200).json(links);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		createShorten: async (req, res) => {
			try {
				const { longURL } = req.body ?? {};
				const shortCode = await shortenService.createShorten(
					longURL,
					req.user.id,
				);
				if (!shortCode) {
					return res.status(400).send("O URL não é valido");
				}

				return res.status(201).json({ shortCode });
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		redirectShort: async (req, res) => {
			try {
				const { shortCode } = req.params;
				const result = await shortenService.redirectShort(shortCode, req.ip);
				if (!result) {
					return res.status(404).send("Link não encontrado");
				}
				if (result.unavailable) {
					return res.status(410).json({ error: "Link expirado ou desativado" });
				}

				return res.status(302).redirect(result.longURL);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		statsShort: async (req, res) => {
			try {
				const { shortCode } = req.params;
				const stats = await shortenService.statsShort(shortCode, req.user.id);
				if (!stats) {
					return res.status(404).send("Link não encontrado");
				}

				return res.status(200).json(stats);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		getShorten: async (req, res) => {
			try {
				const link = await shortenService.getShorten(
					req.params.shortCode,
					req.user.id,
				);
				if (!link) {
					return res.status(404).json({ error: "Link não encontrado" });
				}
				return res.status(200).json(link);
			} catch (error) {
				console.error(error);
				return res.status(500).json({ error: "Erro interno no servidor" });
			}
		},
		updateShorten: async (req, res) => {
			try {
				if (
					!req.body ||
					typeof req.body !== "object" ||
					Array.isArray(req.body) ||
					Object.keys(req.body).length !== 1 ||
					!Object.hasOwn(req.body, "longURL")
				) {
					return res.status(400).json({ error: "Dados do link inválidos" });
				}
				const { longURL } = req.body;
				const link = await shortenService.updateShorten(
					req.params.shortCode,
					req.user.id,
					longURL,
				);
				if (link?.invalid) {
					return res.status(400).json({ error: "URL inválida" });
				}
				if (!link) {
					return res.status(404).json({ error: "Link não encontrado" });
				}
				return res.status(200).json(link);
			} catch (error) {
				console.error(error);
				return res.status(500).json({ error: "Erro interno no servidor" });
			}
		},
		updateSettings: async (req, res) => {
			try {
				const link = await shortenService.updateSettings(
					req.params.shortCode,
					req.user.id,
					req.body,
				);
				if (!link) {
					return res.status(404).json({ error: "Link não encontrado" });
				}
				return res.status(200).json(link);
			} catch (error) {
				if (error instanceof AppError) {
					return res.status(error.statusCode).json({ error: error.message });
				}
				console.error(error);
				return res.status(500).json({ error: "Erro interno no servidor" });
			}
		},
		setActive: async (req, res, isActive = req.body?.active) => {
			try {
				if (typeof isActive !== "boolean") {
					return res.status(400).json({ error: "active deve ser booleano" });
				}
				const active = await shortenService.setActive(
					req.params.shortCode,
					req.user.id,
					isActive,
				);
				if (!active) {
					return res.status(404).json({ error: "Link não encontrado" });
				}
				return res.status(200).json({ active: isActive });
			} catch (error) {
				console.error(error);
				return res.status(500).json({ error: "Erro interno no servidor" });
			}
		},
		analytics: createAnalyticsHandler(shortenService.analytics),
		analyticsCountries: createAnalyticsHandler(shortenService.countries),
		analyticsTimeseries: createAnalyticsHandler(shortenService.timeseries),
		deleteShort: async (req, res) => {
			try {
				const { shortCode } = req.params;
				const deleted = await shortenService.deleteShort(
					shortCode,
					req.user.id,
				);
				if (!deleted) {
					return res.status(404).send("Link não encontrado");
				}

				return res.status(200).send("Registro deletado");
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
	};
};
