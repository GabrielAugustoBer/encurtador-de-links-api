# 🔗 Encurtador de Links API

API REST para encurtar URLs, consultar links e estatísticas de acesso e cadastrar usuários. O servidor usa Express e PostgreSQL; o banco pode ser hospedado no Neon ou em outro serviço compatível com PostgreSQL.

## 🛠️ Tecnologias

- [Node.js](https://nodejs.org/) e [Express](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/) e [`pg`](https://node-postgres.com/)
- [Neon](https://neon.tech/) como opção de hospedagem do PostgreSQL
- [Helmet](https://helmet.js.org/) e [`express-rate-limit`](https://express-rate-limit.mintlify.app/) para proteções HTTP básicas
- [`maxmind`](https://www.npmjs.com/package/maxmind) para consultar uma base GeoIP local
- [Jest](https://jestjs.io/) e [Supertest](https://github.com/ladjs/supertest) para testes
- [`dotenv`](https://github.com/motdotla/dotenv) para carregar variáveis do arquivo `.env`
- [Biome](https://biomejs.dev/) para verificação e formatação do código

## 🚀 Como executar

### Pré-requisitos

- Node.js 20 ou superior e npm
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
JWT_SECRET=gere_uma_chave_aleatoria_com_pelo_menos_32_bytes
GEOIP_DATABASE_PATH=/caminho/seguro/GeoLite2-Country.mmdb
TRUSTED_PROXY_HOPS=0
DATABASE_URL=postgresql://USUARIO:SENHA@HOST/BANCO?sslmode=require
DATABASE_URL_TEST=postgresql://USUARIO:SENHA@HOST/BANCO_TESTE?sslmode=require
```

Preencha `DATABASE_URL` com a string de conexão do seu banco e `JWT_SECRET` com um segredo aleatório de pelo menos 32 bytes. Gere um valor com:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

O servidor usa `DATABASE_URL_TEST` quando `NODE_ENV=test`. Os testes usam um banco simulado e não precisam de uma conexão PostgreSQL.

`GEOIP_DATABASE_PATH` aponta para uma base MaxMind GeoLite2 Country em formato MMDB, instalada localmente; sem essa variável, a API ainda registra cliques, mas classifica a origem geográfica como `unknown`. Obtenha a base conforme os termos de licença da MaxMind e mantenha o arquivo fora do repositório. `TRUSTED_PROXY_HOPS` deve ser `0` quando a API recebe tráfego diretamente ou o número exato de proxies confiáveis à frente dela. A API não confia em `X-Forwarded-For` por padrão.

Em produção, configure também o proxy reverso para aceitar somente tráfego esperado, termine TLS na borda confiável e mantenha `TRUSTED_PROXY_HOPS` alinhado à topologia real. Não defina esse valor para confiar em proxies controlados por clientes.

### 3. Criar as tabelas

Execute no banco:

```sql
CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  short_code VARCHAR(24) UNIQUE NOT NULL,
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

Faça backup do banco. Se a tabela `users` tiver uma coluna `senha` com senhas em texto puro, migre-a antes de iniciar a nova versão:

```bash
npm run migrate:passwords
```

O script substitui os valores por hashes bcrypt e remove a coluna em uma transação. Se uma senha antiga exceder o limite seguro do bcrypt, a migração é cancelada sem alterar os dados; redefina essa senha e tente novamente. Depois, aplique uma única vez e nesta ordem `database/migrations/001_authentication.sql`, `database/migrations/002_click_analytics_and_link_controls.sql` e `database/migrations/003_short_code_entropy.sql`. A primeira adiciona papéis, propriedade dos links e revogação de tokens; por decisão de segurança, exclui links existentes que ainda não tenham proprietário. A segunda habilita eventos de cliques, países, expiração e ativação/desativação. A terceira amplia códigos curtos para acomodar códigos aleatórios de 96 bits. As métricas geográficas começam a ser coletadas após a segunda migração; cliques anteriores não têm dados por país. Se houver e-mails duplicados sem diferenciar maiúsculas/minúsculas, resolva-os antes de criar o índice único.

Contas antigas permanecem sem `password_hash` e não podem entrar até que um administrador defina uma senha por um processo confiável. Para promover o primeiro administrador, cadastre a conta e execute no banco:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

O papel do usuário é consultado no banco a cada requisição autenticada, então alterações de papel passam a valer imediatamente.

### 4. Iniciar a API

```bash
npm run dev
# ou
npm start
```

O servidor usa a porta definida em `PORT`. A rota `GET /` retorna uma mensagem indicando que o servidor está ativo.

## 📌 Rotas

### Documentação no Apidog

O contrato OpenAPI está em [`docs/openapi.yaml`](./docs/openapi.yaml). No Apidog, use **Importar** → **OpenAPI/Swagger** e selecione esse arquivo. Para apontar as requisições a outro ambiente, altere a URL de servidor `http://localhost:3000` ou configure o ambiente no próprio Apidog. As rotas protegidas usam autenticação **Bearer Token**; copie o token retornado por `POST /login`.

| Método | Endpoint | Descrição |
| --- | --- | --- |
| `POST` | `/createShorten` | Cria um link curto |
| `GET` | `/allShorten` | Lista os links do usuário autenticado |
| `GET` | `/links/:shortCode` | Consulta um link próprio |
| `PATCH` | `/links/:shortCode` | Atualiza a URL de um link próprio |
| `DELETE` | `/links/:shortCode` | Exclui um link próprio |
| `GET` | `/links/:shortCode/analytics` | Resume cliques no período escolhido |
| `GET` | `/links/:shortCode/analytics/countries` | Agrupa cliques por país |
| `GET` | `/links/:shortCode/analytics/timeseries` | Retorna cliques por dia |
| `PATCH` | `/links/:shortCode/settings` | Define expiração e estado ativo |
| `POST` | `/links/:shortCode/disable` | Desativa um link |
| `POST` | `/links/:shortCode/enable` | Reativa um link não expirado |
| `GET` | `/:shortCode` | Incrementa os cliques e redireciona para a URL original |
| `GET` | `/:shortCode/stats` | Consulta dados e cliques (autenticado; somente proprietário) |
| `DELETE` | `/links/:shortCode/delete` | Rota antiga de exclusão (autenticado; somente proprietário) |
| `POST` | `/createUser` | Cadastra um usuário |
| `POST` | `/login` | Autentica e retorna um token Bearer |
| `POST` | `/logout` | Revoga o token Bearer atual |
| `GET` | `/me` | Consulta o perfil da sessão autenticada |
| `PATCH` | `/me` | Atualiza nome e/ou e-mail da sessão autenticada |
| `GET` | `/all-users` | Lista usuários (somente administrador) |
| `GET` | `/` | Verifica se o servidor está ativo |

As rotas que recebem JSON esperam o cabeçalho `Content-Type: application/json`; o corpo JSON tem limite de 10 KB. Cadastro e login compartilham um limite de 10 tentativas por IP a cada 15 minutos e respondem `429 Too Many Requests` ao exceder o limite. O armazenamento padrão do limitador é em memória; em produção com múltiplas instâncias, configure um store compartilhado (por exemplo Redis) para que o limite seja aplicado entre instâncias. Gerenciar links (`POST /createShorten`, `GET /allShorten`, consulta/edição/exclusão, configurações e métricas) exige `Authorization: Bearer <token>`. Consulta, edição, métricas e exclusão retornam `404` para links que não pertencem à conta autenticada. Redirecionamentos de links continuam públicos. URLs de destino devem usar `http` ou `https`, não conter credenciais embutidas e ter até 2048 caracteres. Links expirados ou desativados respondem `410 Gone`.

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
  "shortCode": "a1b2c3d4e5f60718293a4b5c"
}
```

Uma URL inválida retorna `400 Bad Request`.

### Listar links (autenticado)

```http
GET /allShorten
Authorization: Bearer <token>
```

Retorna somente os links do usuário autenticado, com `id`, `shortCode`, `longURL`, `clicks` e `created_at`.

### Consultar um link próprio

```http
GET /links/a1b2c3d4e5f60718293a4b5c
Authorization: Bearer <token>
```

Retorna os dados do link se ele pertencer à conta autenticada; caso contrário, responde `404 Not Found`.

### Atualizar um link próprio

```http
PATCH /links/a1b2c3d4e5f60718293a4b5c
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "longURL": "https://example.com/novo-destino"
}
```

Atualiza o destino e retorna os dados do link. A URL precisa usar `http` ou `https`; campos extras ou URL inválida são rejeitados com `400 Bad Request`. Link inexistente ou de outra pessoa retorna `404 Not Found`.

### Métricas e geolocalização

As três rotas aceitam `from` e `to` no formato `YYYY-MM-DD` (UTC), com período máximo de 366 dias. Sem parâmetros, usam os últimos 30 dias. Todas exigem autenticação e só exibem métricas do proprietário:

```http
GET /links/a1b2c3d4e5f60718293a4b5c/analytics/countries?from=2026-10-01&to=2026-10-25
Authorization: Bearer <token>
```

Resposta:

```json
{
  "from": "2026-10-01",
  "to": "2026-10-25",
  "countries": [
    { "country": "BR", "clicks": 120 },
    { "country": "unknown", "clicks": 4 }
  ]
}
```

`GET /links/:shortCode/analytics` retorna o total de cliques e dias com atividade; `GET /links/:shortCode/analytics/timeseries` retorna um item por dia, preenchendo dias sem cliques com zero. A geolocalização usa a base MMDB local, não um serviço externo. O IP é consultado apenas em memória durante o redirecionamento e não é armazenado; quando não houver base, não for possível localizar um endereço ou o acesso vier de IP privado, o país fica como `unknown`. Configure o número exato de proxies confiáveis em `TRUSTED_PROXY_HOPS` se usar reverse proxy, evitando confiar em cabeçalhos encaminhados por clientes.

### Expiração e estado de links

```http
PATCH /links/a1b2c3d4e5f60718293a4b5c/settings
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "expiresAt": "2026-12-31T23:59:59Z",
  "isActive": true
}
```

`expiresAt` deve ser uma data futura ISO 8601 com fuso horário; use `null` para remover a expiração. `isActive` é opcional e booleano. Os endpoints `POST /links/:shortCode/disable` e `/enable` permitem desativar/reativar rapidamente; a reativação não remove uma expiração vencida. Redirecionar um link desativado ou expirado retorna `410 Gone`.

### Acessar um link curto

```http
GET /a1b2c3d4e5f60718293a4b5c
```

Quando o código existe, a API incrementa o contador de cliques e responde com um redirecionamento temporário (`302 Found`) para a URL original, incluída no cabeçalho `Location`. Um código inexistente retorna `404 Not Found`.

### Consultar estatísticas (autenticado e proprietário)

```http
GET /a1b2c3d4e5f60718293a4b5c/stats
Authorization: Bearer <token>
```

Resposta `200 OK`:

```json
{
  "shortCode": "a1b2c3d4e5f60718293a4b5c",
  "longURL": "https://www.google.com",
  "clicks": 5
}
```

### Excluir um link (autenticado e proprietário)

```http
DELETE /links/a1b2c3d4e5f60718293a4b5c/delete
Authorization: Bearer <token>
```

Retorna `200 OK` com a mensagem `Registro deletado`, ou `404 Not Found` se o código não existir.

### Cadastrar, entrar e sair

```http
POST /createUser
Content-Type: application/json
```

```json
{
  "name": "Ana",
  "email": "ana@example.com",
  "senha": "uma-senha-segura"
}
```

A criação exige senha com no mínimo 12 caracteres e no máximo 72 bytes UTF-8. A senha é armazenada como hash bcrypt e nunca é retornada. A resposta `201 Created` contém `id`, `name`, `email` e `role`.

Para entrar, envie o e-mail e a senha:

```http
POST /login
Content-Type: application/json
```

```json
{
  "email": "ana@example.com",
  "senha": "uma-senha-segura"
}
```

A resposta inclui `token` e os dados públicos do usuário. O JWT expira em 15 minutos; envie-o no cabeçalho `Authorization: Bearer <token>` nas rotas protegidas. `POST /logout` com esse cabeçalho revoga o token imediatamente. A listagem `GET /all-users` exige token de uma conta com `role = 'admin'`.

### Consultar e atualizar o perfil

```http
GET /me
Authorization: Bearer <token>
```

Retorna `id`, `name`, `email` e `role` do usuário autenticado. Para atualizar nome e/ou e-mail:

```http
PATCH /me
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "name": "Ana Maria"
}
```

O endpoint aceita apenas `name` e `email`; papéis e senhas não podem ser alterados por esta rota. E-mail duplicado retorna `409 Conflict`; dados inválidos ou campos extras retornam `400 Bad Request`.

Para excluir um link, use `DELETE /links/a1b2c3d4e5f60718293a4b5c`. A rota antiga `DELETE /links/a1b2c3d4e5f60718293a4b5c/delete` continua disponível para compatibilidade.

## 🧪 Testes

Execute a suíte com:

```bash
npm test
```

Os testes das rotas usam uma implementação simulada do banco de dados, portanto não exigem acesso ao Neon nem configuração de `DATABASE_URL_TEST`.

## 🔐 Boas práticas operacionais

- Armazene `.env`, o segredo JWT e a base GeoIP fora do controle de versão; em produção, prefira um gerenciador de segredos.
- Use HTTPS para todas as chamadas autenticadas. O token Bearer concede acesso até expirar ou ser revogado.
- A API envia cabeçalhos de segurança HTTP pelo Helmet, limita o tamanho do JSON e aplica um limite de tentativas a cadastro/login.
- O limitador em memória não coordena múltiplas réplicas: use um armazenamento compartilhado antes de escalar horizontalmente.
- A API não armazena IPs. Os relatórios usam somente país e data; defina uma política de retenção e remova eventos antigos conforme requisitos de privacidade.
- O Pool PostgreSQL tem limite de conexões e timeout de conexão. Ajuste o número máximo considerando o limite de conexões do banco e a quantidade de instâncias da aplicação.
- Atualize dependências e base GeoIP periodicamente; aplique as migrações em ambiente de teste e faça backup antes de produção.
- O endpoint de health-check não deve ser usado para revelar métricas internas ou estado sensível do banco.

## 🧹 Convenções de implementação

- Mantenha validação de entrada antes de operações no banco; consultas usam parâmetros SQL, nunca interpolação de valores fornecidos pelo cliente.
- Repositórios isolam SQL; serviços aplicam regras do domínio; controladores traduzem resultados e erros em respostas HTTP.
- Retorne apenas campos explicitamente permitidos. Nunca serialize diretamente linhas completas de usuários nem hashes de senha.
- Adicione testes de autorização para qualquer endpoint novo que consulte ou altere dados por proprietário.

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
├── database/
│   └── migrations/
│       ├── 001_authentication.sql
│       ├── 002_click_analytics_and_link_controls.sql
│       └── 003_short_code_entropy.sql
├── scripts/
│   └── migrate-plaintext-passwords.js
├── docs/
│   └── openapi.yaml
├── src/
│   ├── controllers/
│   │   ├── shorten.controller.js
│   │   └── users.controller.js
│   ├── errors/
│   │   └── app-error.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── auth-rate-limit.middleware.js
│   │   └── require-role.middleware.js
│   ├── repositories/
│   │   ├── auth.repository.js
│   │   ├── links.repository.js
│   │   └── users.repository.js
│   ├── routes/
│   │   ├── shorten.route.js
│   │   └── users.route.js
│   ├── services/
│   │   ├── auth.services.js
│   │   ├── geoip.service.js
│   │   ├── shorten.services.js
│   │   └── users.services.js
│   ├── tests/
│   │   ├── auth.middleware.test.js
│   │   ├── auth-rate-limit.middleware.test.js
│   │   ├── geoip.service.test.js
│   │   ├── password-migration.test.js
│   │   ├── shorten.route.test.js
│   │   └── users.route.test.js
│   └── server.js
├── .env
├── package.json
└── readme.md
```

## ⏭️ Próximos passos

- Desenvolver uma interface web
- Adicionar métricas de domínios de referência, sem coletar URLs completas ou dados pessoais desnecessários
- Definir e implementar uma política de retenção para eventos de cliques
