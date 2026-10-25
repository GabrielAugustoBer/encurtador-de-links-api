const crypto = require("node:crypto");
const AppError = require("../errors/app-error");

function isHttpUrl(value) {
	if (typeof value !== "string" || URL.canParse(value) !== true) {
		return false;
	}

	const parsedUrl = new URL(value);
	return (
		["http:", "https:"].includes(parsedUrl.protocol) &&
		parsedUrl.hostname.length > 0 &&
		parsedUrl.username.length === 0 &&
		parsedUrl.password.length === 0 &&
		value.length <= 2048
	);
}

function serializeLink(link) {
	return {
		id: link.id,
		shortCode: link.short_code,
		longURL: link.long_url,
		clicks: link.clicks,
		created_at: link.created_at,
		isActive: link.is_active,
		expiresAt: link.expires_at,
	};
}

function validateDateRange(from, to) {
	const today = new Date().toISOString().slice(0, 10);
	const defaultFrom = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);
	const start = from ?? defaultFrom;
	const end = to ?? today;
	const isDate = (value) =>
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
		new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

	if (!isDate(start) || !isDate(end) || start > end) {
		throw new AppError(400, "Período de datas inválido");
	}
	const days =
		(Date.parse(`${end}T00:00:00.000Z`) -
			Date.parse(`${start}T00:00:00.000Z`)) /
		86_400_000;
	if (days > 365) {
		throw new AppError(400, "O período máximo permitido é de 366 dias");
	}
	return { from: start, to: end };
}

module.exports = function createShortenService(
	linksRepository,
	geoLocate = async () => null,
) {
	return {
		allShorten: async (userId) => {
			const links = await linksRepository.findAll(userId);
			return links.map(serializeLink);
		},
		createShorten: async (longURL, userId) => {
			if (!isHttpUrl(longURL)) {
				return null;
			}

			const shortCode = crypto.randomBytes(12).toString("hex");
			await linksRepository.create(shortCode, longURL, userId);
			return shortCode;
		},
		redirectShort: async (shortCode, ipAddress) => {
			const link = await linksRepository.findByShortCode(shortCode);
			if (!link) {
				return null;
			}

			if (
				link.is_active === false ||
				(link.expires_at && new Date(link.expires_at).getTime() <= Date.now())
			) {
				return { unavailable: true };
			}

			let countryCode = null;
			try {
				countryCode = await geoLocate(ipAddress);
			} catch (error) {
				console.error("Falha na consulta local de geolocalização:", error);
			}
			if (typeof countryCode !== "string" || !/^[A-Z]{2}$/.test(countryCode)) {
				countryCode = null;
			}

			const destination = await linksRepository.recordClickAndGetDestination(
				shortCode,
				countryCode,
			);
			return destination ? { longURL: destination } : null;
		},
		statsShort: async (shortCode, userId) => {
			const link = await linksRepository.findByShortCodeAndUser(
				shortCode,
				userId,
			);
			if (!link) {
				return null;
			}

			return {
				shortCode,
				longURL: link.long_url,
				clicks: link.clicks,
				isActive: link.is_active,
				expiresAt: link.expires_at,
			};
		},
		getShorten: async (shortCode, userId) => {
			const link = await linksRepository.findByShortCodeAndUser(
				shortCode,
				userId,
			);
			if (!link) {
				return null;
			}
			return serializeLink(link);
		},
		updateShorten: async (shortCode, userId, longURL) => {
			if (
				typeof longURL !== "string" ||
				longURL.length > 2048 ||
				!isHttpUrl(longURL)
			) {
				return { invalid: true };
			}
			const link = await linksRepository.updateByShortCodeAndUser(
				shortCode,
				userId,
				longURL,
			);
			if (!link) {
				return null;
			}
			return serializeLink(link);
		},
		updateSettings: async (shortCode, userId, changes) => {
			if (
				!changes ||
				typeof changes !== "object" ||
				Array.isArray(changes) ||
				!Object.keys(changes).length ||
				Object.keys(changes).some(
					(key) => !["expiresAt", "isActive"].includes(key),
				)
			) {
				throw new AppError(400, "Configurações de link inválidas");
			}

			let expiresAt = null;
			if (Object.hasOwn(changes, "expiresAt")) {
				if (changes.expiresAt === null) {
					expiresAt = null;
				} else if (
					typeof changes.expiresAt !== "string" ||
					Number.isNaN(Date.parse(changes.expiresAt)) ||
					!/[Tt]/.test(changes.expiresAt) ||
					!/(Z|[+-]\d{2}:\d{2})$/i.test(changes.expiresAt) ||
					Date.parse(changes.expiresAt) <= Date.now()
				) {
					throw new AppError(
						400,
						"expiresAt deve ser uma data futura em formato ISO 8601 ou null",
					);
				} else {
					expiresAt = new Date(changes.expiresAt);
				}
			}

			let isActive = false;
			if (Object.hasOwn(changes, "isActive")) {
				if (typeof changes.isActive !== "boolean") {
					throw new AppError(400, "isActive deve ser booleano");
				}
				isActive = changes.isActive;
			}

			const link = await linksRepository.updateSettings(shortCode, userId, {
				hasExpiresAt: Object.hasOwn(changes, "expiresAt"),
				expiresAt,
				hasIsActive: Object.hasOwn(changes, "isActive"),
				isActive,
			});
			if (!link) {
				return null;
			}
			return serializeLink(link);
		},
		setActive: async (shortCode, userId, isActive) => {
			if (typeof isActive !== "boolean") {
				throw new AppError(400, "active deve ser booleano");
			}
			return linksRepository.setActive(shortCode, userId, isActive);
		},
		analytics: async (shortCode, userId, from, to) => {
			const range = validateDateRange(from, to);
			const link = await linksRepository.findByShortCodeAndUser(
				shortCode,
				userId,
			);
			if (!link) {
				return null;
			}
			const summary = await linksRepository.getAnalyticsSummary(
				shortCode,
				userId,
				range.from,
				range.to,
			);
			return { from: range.from, to: range.to, ...summary };
		},
		countries: async (shortCode, userId, from, to) => {
			const range = validateDateRange(from, to);
			const link = await linksRepository.findByShortCodeAndUser(
				shortCode,
				userId,
			);
			if (!link) {
				return null;
			}
			const countries = await linksRepository.getCountryAnalytics(
				shortCode,
				userId,
				range.from,
				range.to,
			);
			return { from: range.from, to: range.to, countries };
		},
		timeseries: async (shortCode, userId, from, to) => {
			const range = validateDateRange(from, to);
			const link = await linksRepository.findByShortCodeAndUser(
				shortCode,
				userId,
			);
			if (!link) {
				return null;
			}
			const rows = await linksRepository.getDailyAnalytics(
				shortCode,
				userId,
				range.from,
				range.to,
			);
			const clicksByDate = new Map(
				rows
					.filter((row) => row.date)
					.map((row) => [
						new Date(row.date).toISOString().slice(0, 10),
						row.clicks,
					]),
			);
			const series = [];
			for (
				let day = Date.parse(`${range.from}T00:00:00.000Z`);
				day <= Date.parse(`${range.to}T00:00:00.000Z`);
				day += 86_400_000
			) {
				const date = new Date(day).toISOString().slice(0, 10);
				series.push({ date, clicks: clicksByDate.get(date) ?? 0 });
			}
			return { from: range.from, to: range.to, series };
		},
		deleteShort: (shortCode, userId) =>
			linksRepository.deleteByShortCode(shortCode, userId),
	};
};
