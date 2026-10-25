const { rateLimit } = require("express-rate-limit");

module.exports = function createAuthRateLimit(options = {}) {
	return rateLimit({
		windowMs: 15 * 60 * 1000,
		limit: 10,
		standardHeaders: true,
		legacyHeaders: false,
		handler: (_req, res) =>
			res
				.status(429)
				.json({ error: "Muitas tentativas. Tente novamente depois." }),
		...options,
	});
};
