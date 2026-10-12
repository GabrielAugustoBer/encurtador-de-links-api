# 🔗 Encurtador de Links API

Uma API RESTful robusta e de alta performance para encurtar URLs, monitorar métricas de acesso e gerenciar links. O projeto foi desenvolvido com foco nas melhores práticas de engenharia de software, incluindo **testes de integração atômicos**, **isolamento total de ambiente** e utilização de **branches efêmeras no PostgreSQL (Neon DB)**.

---

## 🛠️ Tecnologias Utilizadas

- **Runtime & Server**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) via [Neon DB](https://neon.tech/) (Servidor Serverless)
- **Driver de Banco**: [`pg` (node-postgres)](https://node-postgres.com/)
- **Testes de Integração**: [Jest](https://jestjs.io/) & [Supertest](https://github.com/ladjs/supertest)
- **Gerenciamento de Variáveis de Ambiente**: [`dotenv`](https://github.com/motdotla/dotenv)

---

## 📐 Arquitetura & Boas Práticas

- **Testes Atômicos e Independentes**: Cada teste é responsável pelo seu próprio ciclo de setup e limpeza, garantindo independência total na execução da suíte de testes.
- **Isolamento de Banco de Dados**: A aplicação alterna dinamicamente a conexão do banco com base na variável `NODE_ENV`. Testes jamais afetam o banco de produção.
- **Suporte a Branches Efêmeras (Neon)**: A suíte de testes executa contra uma branch temporária isolada do Neon DB.
- **Execução em Memória no Modo Teste**: O servidor previne o bind de porta física (`app.listen()`) durante a execução do Jest, permitindo que o Supertest gerencie requisições HTTP diretamente na memória.

---

## 📌 Rotas da API

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/shorten` | Gera um novo código encurtado para uma URL válida |
| `GET` | `/:shortCode` | Redireciona para a URL original e incrementa a contagem de cliques |
| `GET` | `/:shortCode/stats` | Retorna as estatísticas de acesso e metadados do link |
| `DELETE` | `/:shortCode/delete` | Remove um link do banco de dados |

---

## 📄 Detalhamento dos Endpoints

### 1. Encurtar URL
- **Endpoint**: `POST /shorten`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "longURL": "https://www.google.com"
  }
  ```
- **Respostas**:
  - `201 Created`:
    ```json
    {
      "shortCode": "a1b2c3d4"
    }
    ```
  - `400 Bad Request`: `URL inválida`

---

### 2. Redirecionar URL
- **Endpoint**: `GET /:shortCode`
- **Parâmetros de Rota**: `shortCode` (ex: `a1b2c3d4`)
- **Respostas**:
  - `302 Found`: Redireciona automaticamente para a URL original associada.
  - `404 Not Found`: Link não encontrado.

---

### 3. Estatísticas do Link
- **Endpoint**: `GET /:shortCode/stats`
- **Parâmetros de Rota**: `shortCode` (ex: `a1b2c3d4`)
- **Respostas**:
  - `200 OK`:
    ```json
    {
      "shortCode": "a1b2c3d4",
      "longURL": "https://www.google.com",
      "clicks": 5
    }
    ```
  - `404 Not Found`: Link não encontrado.

---

### 4. Deletar Link
- **Endpoint**: `DELETE /:shortCode/delete`
- **Parâmetros de Rota**: `shortCode` (ex: `a1b2c3d4`)
- **Respostas**:
  - `200 OK`: `Registro deletado`
  - `404 Not Found`: Link não encontrado.

---

## 🚀 Como Clonar e Rodar o Projeto Localmente

### 📋 Pré-requisitos
- **Node.js** (v18 ou superior)
- **Git**
- Uma conta ativa no **Neon DB** (ou uma instância local de PostgreSQL)

### 💻 Passo a Passo

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/GabrielAugustoBer/encurtador-de-links.git
   cd encurtador-de-links
   ```

2. **Instalar as Dependências**:
   ```bash
   npm install
   ```

3. **Configurar o Arquivo `.env`**:
   Crie um arquivo `.env` na raiz do projeto com o seguinte modelo:
   ```env
   PORT=3000
   PORT_TEST=3030
   DATABASE_URL=postgresql://usuario:senha@ep-producao.neon.tech/neondb?sslmode=require
   DATABASE_URL_TEST=postgresql://usuario:senha@ep-teste.neon.tech/neondb?sslmode=require
   ```

4. **Estrutura da Tabela no Banco de Dados**:
   Execute a query SQL abaixo no seu banco para criar a tabela de links:
   ```sql
   CREATE TABLE IF NOT EXISTS links (
     id SERIAL PRIMARY KEY,
     short_code VARCHAR(10) UNIQUE NOT NULL,
     long_url TEXT NOT NULL,
     clicks INT DEFAULT 0,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

5. **Iniciar a Aplicação**:
   ```bash
   # Modo de desenvolvimento
   npm run dev

   # Modo de produção
   npm start
   ```

---

## 🧪 Executando os Testes

Para executar a suíte de testes de integração e verificar a integridade de todas as rotas CRUD:

```bash
npm test
```

A suíte executará os testes atômicos alternando automaticamente para a variável `DATABASE_URL_TEST`.

---

## 📁 Estrutura do Projeto

```text
encurtador-de-links/
├── src/
│   ├── server.js          # Configuração do Express e definições das rotas
│   └── tests/
│       └── app.test.js    # Suíte de testes de integração com Jest e Supertest
├── .env                   # Variáveis de ambiente (não comitado)
├── .gitignore             # Arquivos ignorados pelo Git
├── package.json           # Dependências e scripts do projeto
└── README.md              # Documentação oficial do projeto
```