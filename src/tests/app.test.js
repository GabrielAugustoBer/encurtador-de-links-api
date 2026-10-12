const request = require("supertest");
const { app, db } = require("../server");

// Variável para rastrear o código gerado durante cada teste individual 🧪
let createdCode = null;

// Limpeza automatizada executada após CADA teste 🧹
afterEach(async () => {
  if (createdCode) {
    await request(app).delete(`/${createdCode}/delete`);
    createdCode = null;
  }
});

// Encerra a conexão com o pool do PostgreSQL ao final de TODOS os testes 🔌
afterAll(async () => {
  await db.end();
});

describe("Suíte de Testes de Integração - Encurtador de URL 🔗", () => {

  // 1. Rota POST /shorten (Criação) 📝
  describe("POST /shorten", () => {
    test("Deve retornar status 201 e o shortCode ao enviar uma URL válida", async () => {
      const response = await request(app)
        .post("/shorten")
        .send({ longURL: "https://google.com" });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("shortCode");

      // Guarda para o afterEach deletar do banco de testes
      createdCode = response.body.shortCode;
    });

    test("Deve retornar status 400 ao enviar uma URL inválida", async () => {
      const response = await request(app)
        .post("/shorten")
        .send({ longURL: "url-invalida" });

      expect(response.status).toBe(400);
    });
  });

  // 2. Rota GET /:shortCode (Redirecionamento) ↪️
  describe("GET /:shortCode", () => {
    test("Deve redirecionar (302) para a URL original quando o código existir", async () => {
      // Setup atômico: cria o link necessário apenas para este teste
      const setup = await request(app)
        .post("/shorten")
        .send({ longURL: "https://google.com" });
      createdCode = setup.body.shortCode;

      const response = await request(app).get(`/${createdCode}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("https://google.com");
    });

    test("Deve retornar status 404 para um código inexistente", async () => {
      const response = await request(app).get("/codigo-inexistente");

      expect(response.status).toBe(404);
    });
  });

  // 3. Rota GET /:shortCode/stats (Consulta de Métricas) 📊
  describe("GET /:shortCode/stats", () => {
    test("Deve retornar status 200 e as estatísticas do link recém-criado", async () => {
      // Setup atômico
      const setup = await request(app)
        .post("/shorten")
        .send({ longURL: "https://teste.com" });
      createdCode = setup.body.shortCode;

      const response = await request(app).get(`/${createdCode}/stats`);

      expect(response.status).toBe(200);
      expect(response.body.shortCode).toBe(createdCode);
      expect(response.body).toHaveProperty("longURL", "https://teste.com");
      expect(response.body).toHaveProperty("clicks");
    });

    test("Deve retornar status 404 ao buscar estatísticas de código inexistente", async () => {
      const response = await request(app).get("/codigo-inexistente/stats");

      expect(response.status).toBe(404);
    });
  });

  // 4. Rota DELETE /:shortCode/delete (Exclusão) 🗑️
  describe("DELETE /:shortCode/delete", () => {
    test("Deve deletar o registro com sucesso e retornar status 200", async () => {
      // Setup atômico
      const setup = await request(app)
        .post("/shorten")
        .send({ longURL: "https://deletar.com" });
      const codeToDelete = setup.body.shortCode;

      const response = await request(app).delete(`/${codeToDelete}/delete`);

      expect(response.status).toBe(200);

      // Como este teste já deletou o registro, não precisamos que o afterEach tente novamente
      createdCode = null;
    });

    test("Deve retornar status 404 ao tentar deletar um código inexistente", async () => {
      const response = await request(app).delete("/codigo-inexistente/delete");

      expect(response.status).toBe(404);
    });
  });
});