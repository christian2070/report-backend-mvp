# Cidades Inteligentes — Backend MVP

API REST para rede social de reporte de problemas urbanos. Cidadãos publicam reportes com foto; a prefeitura gerencia status e acompanha métricas no dashboard.

## Edição de reportes e perfil

Os endpoints autenticados `PATCH /api/reportes/:id` e `DELETE /api/reportes/:id` permitem editar/excluir apenas reportes do próprio cidadão. Reportes resolvidos não podem ser editados. A edição aceita `descricao`, `categoria`, `localizacao` e `foto` opcional via multipart; a exclusão retorna `204`.

`PATCH /api/auth/me` atualiza `nome`, `email` e `bairro` opcional do cidadão. O ID vem exclusivamente do JWT; dados protegidos são rejeitados. E-mail de outro usuário retorna `409`.

`PATCH /api/auth/me/password` recebe `senhaAtual`, `novaSenha` e `confirmarNovaSenha`, valida a senha atual e a confirmação, e grava bcrypt sem invalidar o JWT. A nova senha exige ao menos 6 caracteres. Senha atual incorreta retorna `400`.

A migration `1794860000000-PendingFileDeletions.ts` é obrigatória. Ela cria uma fila de limpeza de fotos: o registro da limpeza é confirmado junto com a alteração/exclusão do reporte; o arquivo só é removido depois do commit. Falhas de filesystem são repetidas na inicialização e a cada 60 segundos. Confirmações e reporte são excluídos na mesma transação, com autorização verificada sob bloqueio de escrita.

Execute `npm test -- --runInBand` para as 5 suítes de unidade/HTTP. Para integração real, configure `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER` e `TEST_DB_PASSWORD` para uma instância MySQL de testes e execute `npm run test:integration`. A conta precisa criar/remover bancos: a suíte cria `report_features_test_*`, aplica migrations com sincronização desativada e remove o banco ao terminar, sem usar `DB_NAME`. O Jest executa com suporte a módulos VM/ESM para as dependências instaladas.

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

5. Rode as migrations antes de iniciar a aplicação, incluindo a fila de limpeza de fotos usada na edição e exclusão de reportes:

```bash
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
