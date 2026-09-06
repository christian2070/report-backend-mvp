# Cidades Inteligentes — Backend MVP

API REST para rede social de reporte de problemas urbanos. Cidadãos publicam reportes com foto; a prefeitura gerencia status e acompanha métricas no dashboard.

## Stack

- NestJS (arquitetura hexagonal)
- TypeORM + MySQL
- JWT + bcrypt
- Upload local de imagens (`/uploads`)

## Pré-requisitos

- Node.js 18+
- MySQL 8+

## Setup

1. Clone o repositório e instale dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Crie o banco MySQL:

```sql
CREATE DATABASE cidades_inteligentes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

4. Configure as variáveis em `.env` (host, usuário, senha do MySQL, `JWT_SECRET`, etc.).

5. Sincronize o schema (dev) **ou** rode a migration:

```bash
# Opção A — dev rápido (DB_SYNCHRONIZE=true no .env)
npm run start:dev

# Opção B — migration explícita
npm run typeorm:migration:run
```

6. Crie a conta da prefeitura (seed idempotente):

```bash
npm run seed
```

7. Inicie a API:

```bash
npm run start:dev
```

Base URL: `http://localhost:3000/api`

## Arquitetura

```
src/
├── auth/          # Cadastro, login, JWT
├── reportes/      # CRUD de reportes + upload
├── alertas/       # Like/confirmação em reportes
├── dashboard/     # Painel da prefeitura
└── common/        # Guards, filters, enums compartilhados
```

Cada módulo segue camadas:

- `domain/` — entidades e ports (interfaces)
- `application/` — use cases e DTOs
- `infrastructure/` — TypeORM, JWT, file storage
- `presentation/` — controllers

## Autenticação

Todas as rotas protegidas exigem header:

```
Authorization: Bearer <token>
```

O token JWT contém `sub` (id do usuário) e `tipo` (`CIDADAO` ou `PREFEITURA`).

## Endpoints

### Auth

| Método | Rota | Acesso |
|--------|------|--------|
| POST | `/auth/register` | Público |
| POST | `/auth/login` | Público |
| GET | `/auth/me` | Autenticado |

### Reportes

| Método | Rota | Acesso |
|--------|------|--------|
| POST | `/reportes` | Cidadão |
| GET | `/reportes` | Público |
| GET | `/reportes/resolvidos` | Público |
| GET | `/reportes/:id` | Público |
| PATCH | `/reportes/:id/status` | Prefeitura |

### Alertas

| Método | Rota | Acesso |
|--------|------|--------|
| POST | `/reportes/:id/alertas` | Cidadão |
| DELETE | `/reportes/:id/alertas` | Cidadão |

### Dashboard

| Método | Rota | Acesso |
|--------|------|--------|
| GET | `/dashboard/resumo` | Prefeitura |

## Exemplos (curl)

### Cadastro de cidadão

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nome":"Maria Silva","email":"maria@email.com","senha":"123456","bairro":"Centro"}'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"maria@email.com","senha":"123456"}'
```

### Login prefeitura (conta do seed)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"prefeitura@cidades.gov.br","senha":"admin123"}'
```

### Criar reporte (multipart)

```bash
curl -X POST http://localhost:3000/api/reportes \
  -H "Authorization: Bearer <TOKEN_CIDADAO>" \
  -F "foto=@/caminho/foto.jpg" \
  -F "descricao=Poste apagado há 3 dias" \
  -F "categoria=ILUMINACAO" \
  -F "localizacao=Rua das Flores, Centro"
```

### Feed (ordenado por alertas)

```bash
curl "http://localhost:3000/api/reportes?ordenacao=alertas&page=1&limit=10"
```

### Dar alerta

```bash
curl -X POST http://localhost:3000/api/reportes/<REPORTE_ID>/alertas \
  -H "Authorization: Bearer <TOKEN_CIDADAO>"
```

### Alterar status (prefeitura)

```bash
curl -X PATCH http://localhost:3000/api/reportes/<REPORTE_ID>/status \
  -H "Authorization: Bearer <TOKEN_PREFEITURA>" \
  -H "Content-Type: application/json" \
  -d '{"status":"EM_ANDAMENTO"}'
```

### Dashboard

```bash
curl http://localhost:3000/api/dashboard/resumo \
  -H "Authorization: Bearer <TOKEN_PREFEITURA>"
```

## Regras de negócio principais

- Apenas **cidadãos** criam reportes e dão alertas
- Cidadão **não pode alertar o próprio reporte**
- Alerta é **único por (usuário, reporte)** — duplicata retorna 409
- Reportes **RESOLVIDO** não aceitam novos alertas e saem do feed principal
- Status segue fluxo rígido: `ABERTO → EM_ANDAMENTO → RESOLVIDO`
- Apenas **prefeitura** altera status e acessa dashboard

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run start:dev` | Desenvolvimento com hot reload |
| `npm run build` | Compila TypeScript |
| `npm run seed` | Cria conta da prefeitura |
| `npm run typeorm:migration:run` | Executa migrations |

## Variáveis de ambiente

Veja [`.env.example`](.env.example) para a lista completa.
