# 🔗 Encurtador de Links API

API REST para encurtar URLs, consultar links e estatísticas de acesso e cadastrar usuários. O servidor usa Express e PostgreSQL; o banco pode ser hospedado no Neon ou em outro serviço compatível com PostgreSQL.

## 🛠️ Tecnologias

- [Node.js](https://nodejs.org/) e [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/) e [`pg`](https://node-postgres.com/)
- [Neon](https://neon.tech/) como opção de hospedagem do PostgreSQL
- [Jest](https://jestjs.io/) e [Supertest](https://github.com/ladjs/supertest) para testes
- [`dotenv`](https://github.com/motdotla/dotenv) para carregar variáveis do arquivo `.env`
- [Biome](https://biomejs.dev/) para verificação e formatação do código

## 🚀 Como executar

### Pré-requisitos

- Node.js e npm
- Um banco PostgreSQL acessível pela aplicação

### 1. Clonar e instalar

```bash
git clone https://github.com/GabrielAugustoBer/encurtador-de-links-api.git
cd encurtador-de-links-api
npm install
```

### 2. Configurar as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
PORT=3000
PORT_TEST=3030
DATABASE_URL=postgresql://USUARIO:SENHA@HOST/BANCO?sslmode=require
DATABASE_URL_TEST=postgresql://USUARIO:SENHA@HOST/BANCO_TESTE?sslmode=require
```

Preencha `DATABASE_URL` com a string de conexão do seu banco. O servidor usa `DATABASE_URL_TEST` quando `NODE_ENV=test`. Os testes atuais usam um banco simulado e não precisam de uma conexão PostgreSQL.

### 3. Criar as tabelas

Execute no banco:

```sql
CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  clicks INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL
);
```

### 4. Iniciar a API

```bash
npm run dev
# ou
npm start
```

O servidor usa a porta definida em `PORT`. A rota `GET /` retorna uma mensagem indicando que o servidor está ativo.

## 📌 Rotas

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/createShorten` | Cria um link curto |
| `GET` | `/allShorten` | Lista os links |
| `GET` | `/:shortCode` | Incrementa os cliques e redireciona para a URL original |
| `GET` | `/:shortCode/stats` | Consulta os dados e os cliques de um link |
| `DELETE` | `/links/:shortCode/delete` | Exclui um link |
| `POST` | `/createUser` | Cadastra um usuário |
| `GET` | `/all-users` | Lista os usuários |
| `GET` | `/` | Verifica se o servidor está ativo |

As rotas que recebem JSON esperam o cabeçalho `Content-Type: application/json`.

## 📄 Exemplos de uso

### Criar um link curto

```http
POST /createShorten
Content-Type: application/json
```

```json
{
  "longURL": "https://www.google.com"
}
```

Resposta `201 Created`:

```json
{
  "shortCode": "a1b2c3d4"
}
```

Uma URL inválida retorna `400 Bad Request`.

### Listar links

```http
GET /allShorten
```

Retorna uma lista com `id`, `shortCode`, `longURL`, `clicks` e `created_at`.

### Acessar um link curto

```http
GET /a1b2c3d4
```

Quando o código existe, a API incrementa o contador de cliques e responde com um redirecionamento temporário (`302 Found`) para a URL original, incluída no cabeçalho `Location`. Um código inexistente retorna `404 Not Found`.

### Consultar estatísticas

```http
GET /a1b2c3d4/stats
```

Resposta `200 OK`:

```json
{
  "shortCode": "a1b2c3d4",
  "longURL": "https://www.google.com",
  "clicks": 5
}
```

### Excluir um link

```http
DELETE /links/a1b2c3d4/delete
```

Retorna `200 OK` com a mensagem `Registro deletado`, ou `404 Not Found` se o código não existir.

### Cadastrar e listar usuários

```http
POST /createUser
Content-Type: application/json
```

```json
{
  "name": "Ana",
  "email": "ana@example.com"
}
```

A criação retorna `201 Created` com os campos `name` e `email`. Para listar os usuários, use `GET /all-users`.

## 🧪 Testes

Execute a suíte com:

```bash
npm test
```

Os testes das rotas usam uma implementação simulada do banco de dados, portanto não exigem acesso ao Neon nem configuração de `DATABASE_URL_TEST`.

## ✅ Verificação e formatação

```bash
npm run check        # Verificação do Biome
npm run lint         # Apenas lint
npm run format       # Formata os arquivos
npm run format:check # Verifica a formatação sem alterar arquivos
```

## 📁 Estrutura do projeto

```text
encurtador-de-links-api/
├── src/
│   ├── controllers/
│   │   ├── shorten.controller.js
│   │   └── users.controller.js
│   ├── repositories/
│   │   ├── links.repository.js
│   │   └── users.repository.js
│   ├── routes/
│   │   ├── shorten.route.js
│   │   └── users.route.js
│   ├── services/
│   │   ├── shorten.services.js
│   │   └── users.services.js
│   ├── tests/
│   │   ├── shorten.route.test.js
│   │   └── users.route.test.js
│   └── server.js
├── .env
├── package.json
└── readme.md
```

## ⏭️ Próximos passos

- Desenvolver uma interface web
- Implementar autenticação
- Coletar métricas adicionais de acesso
