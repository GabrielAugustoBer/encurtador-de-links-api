const maxmind = require("maxmind");
const net = require("node:net");

module.exports = async function createGeoIpService(databasePath) {
	if (!databasePath) {
		return async () => null;
	}

	const reader = await maxmind.open(databasePath);
	return async (ipAddress) => {
		if (typeof ipAddress !== "string" || net.isIP(ipAddress) === 0) {
			return null;
		}
		const countryCode = reader.get(ipAddress)?.country?.iso_code;
		return typeof countryCode === "string" && /^[A-Z]{2}$/.test(countryCode)
			? countryCode
			: null;
	};
};
