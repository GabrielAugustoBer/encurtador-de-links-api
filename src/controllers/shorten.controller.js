module.exports = function shortenController(shortenService) {
	return {
		allShorten: async (_req, res) => {
			try {
				const links = await shortenService.allShorten();
				return res.status(200).json(links);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		createShorten: async (req, res) => {
			try {
				const { longURL } = req.body;
				const shortCode = await shortenService.createShorten(longURL);
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
				const longURL = await shortenService.redirectShort(shortCode);
				if (!longURL) {
					return res.status(404).send("Link não encontrado");
				}

				return res.status(302).redirect(longURL);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		statsShort: async (req, res) => {
			try {
				const { shortCode } = req.params;
				const stats = await shortenService.statsShort(shortCode);
				if (!stats) {
					return res.status(404).send("Link não encontrado");
				}

				return res.status(200).json(stats);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		deleteShort: async (req, res) => {
			try {
				const { shortCode } = req.params;
				const deleted = await shortenService.deleteShort(shortCode);
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
