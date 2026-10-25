const createGeoIpService = require("../services/geoip.service");

describe("Serviço de geolocalização", () => {
	test("usa país desconhecido quando não há base local configurada", async () => {
		const geoLocate = await createGeoIpService(undefined);

		await expect(geoLocate("8.8.8.8")).resolves.toBeNull();
	});

	test("não aceita caminho de base GeoIP inexistente", async () => {
		await expect(
			createGeoIpService("/caminho/inexistente/GeoLite2-Country.mmdb"),
		).rejects.toThrow();
	});
});
