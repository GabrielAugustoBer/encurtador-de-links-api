const crypto = require("node:crypto");

module.exports = function createShortenService(linksRepository) {
	return {
		allShorten: async () => {
			const links = await linksRepository.findAll();
			return links.map((row) => ({
				id: row.id,
				shortCode: row.short_code,
				longURL: row.long_url,
				clicks: row.clicks,
				created_at: row.created_at,
			}));
		},
		createShorten: async (longURL) => {
			if (URL.canParse(longURL) !== true) {
				return null;
			}

			const shortCode = crypto.randomBytes(4).toString("hex");
			await linksRepository.create(shortCode, longURL);
			return shortCode;
		},
		redirectShort: async (shortCode) => {
			const link = await linksRepository.findByShortCode(shortCode);
			if (!link) {
				return null;
			}

			await linksRepository.incrementClicks(shortCode);
			return link.long_url;
		},
		statsShort: async (shortCode) => {
			const link = await linksRepository.findByShortCode(shortCode);
			if (!link) {
				return null;
			}

			return {
				shortCode,
				longURL: link.long_url,
				clicks: link.clicks,
			};
		},
		deleteShort: (shortCode) => linksRepository.deleteByShortCode(shortCode),
	};
};
