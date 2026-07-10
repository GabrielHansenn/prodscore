# ProdScore

Plataforma de gerenciamento de tarefas com gamificação. Desenvolvida como Trabalho de Conclusão de Curso (TCC).

## Sobre o Projeto

O ProdScore transforma a gestão de tarefas em uma experiência gamificada: os usuários ganham pontos ao concluir tarefas, mantêm sequências (streaks) de dias produtivos, sobem de nível, desbloqueiam conquistas e competem em rankings individuais e de grupo.

## Stack Tecnológica

| Camada     | Tecnologia                                          |
|------------|-----------------------------------------------------|
| Frontend   | React 18 + Vite + TypeScript + Tailwind CSS + Zustand + React Router v6 |
| Mobile     | React Native (Expo) + TypeScript                    |
| Backend    | Node.js + Express + TypeScript                      |
| Banco/BaaS | Supabase (PostgreSQL + Auth + Realtime)             |
| Deploy     | Vercel (web + api)                                  |
| Monorepo   | npm workspaces                                      |

## Estrutura de Pastas

```
prodscore/
├── apps/
│   ├── web/          # Aplicação React (Vite)
│   └── mobile/       # Aplicação React Native (Expo)
├── packages/
│   ├── api/          # Servidor Express (backend)
│   └── shared/       # Tipos TypeScript e constantes compartilhados
├── supabase/
│   ├── migrations/   # Arquivos SQL de migração do banco
│   └── seed.sql      # Dados iniciais de desenvolvimento
├── .env.example      # Modelo de variáveis de ambiente
├── package.json      # Raiz do monorepo (npm workspaces)
└── tsconfig.base.json
```

## Variáveis de Ambiente

Copie `.env.example` para `.env` na raiz e preencha:

```env
SUPABASE_URL=             # URL do projeto Supabase
SUPABASE_ANON_KEY=        # Chave anônima (pública)
SUPABASE_SERVICE_ROLE_KEY= # Chave de service role (apenas backend)
JWT_SECRET=               # Segredo para JWT
PORT=3333                 # Porta do servidor Express
```

Para o frontend (`apps/web`), crie `apps/web/.env.local`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Como Rodar

### Pré-requisitos

- Node.js >= 20
- npm >= 10

### Instalação

```bash
npm install
```

### Compilar tipos compartilhados (necessário antes dos outros pacotes)

```bash
npm run build:shared
```

### Rodar o Backend (API)

```bash
npm run dev:api
# Servidor disponível em http://localhost:3333
```

### Rodar o Frontend Web

```bash
npm run dev:web
# Disponível em http://localhost:5173
```

### Rodar o App Mobile

```bash
npm run dev:mobile
# Abre o Expo Go — leia o QR code com o aplicativo Expo Go no celular
```

### Migrations do Banco de Dados

Execute os arquivos em ordem via Supabase Dashboard (SQL Editor) ou CLI:

```bash
supabase db push
```

## Regras de Gamificação

| Dificuldade | Pontos Base |
|-------------|-------------|
| Fácil       | 10 pts      |
| Média       | 25 pts      |
| Difícil     | 50 pts      |
| Épica       | 100 pts     |

- **Bônus de pontualidade:** +20% se concluída antes do prazo
- **Penalidade de atraso:** -30% se concluída após o prazo
- **Bônus de streak:** +50 pts ao atingir marcos de 3, 7, 14, 30, 60 e 90 dias consecutivos
- **Level up:** `nível² × 100` pontos totais para entrar em cada nível

## Testes

```bash
# Testes unitários da API (Jest + Supertest)
npm run test --workspace=packages/api

# Cobertura da API
npm run test:coverage --workspace=packages/api

# Testes do frontend (Vitest + React Testing Library)
npm run test --workspace=apps/web

# Cobertura do frontend
npm run test:coverage --workspace=apps/web
```

### Cobertura de testes implementada

| Arquivo                         | O que testa                                             |
|---------------------------------|---------------------------------------------------------|
| `gamification.service.test.ts`  | `calculatePoints`, `levelThreshold`, `updateStreak`, `checkLevelUp` |
| `task.service.test.ts`          | `completeTask` com bônus, penalidade, erros e nível     |
| `TaskCard.test.tsx`             | Badges, botão Concluir, preview de pontos, callback     |
| `DashboardPage.test.tsx`        | Carregamento, stats, lista do dia, quick-complete       |
| `authStore.test.ts`             | Login, logout, estado inicial                           |

## Deploy

O projeto está configurado para deploy na [Vercel](https://vercel.com) via `vercel.json` na raiz.

### Variáveis de ambiente — Vercel (Secrets)

Configure no painel do projeto (Settings → Environment Variables):

| Variável                    | Ambiente |
|-----------------------------|----------|
| `SUPABASE_URL`              | API      |
| `SUPABASE_SERVICE_ROLE_KEY` | API      |
| `FRONTEND_URL`              | API      |
| `VITE_SUPABASE_URL`         | Web      |
| `VITE_SUPABASE_ANON_KEY`    | Web      |
| `VITE_API_URL`              | Web      |

### Deploy manual

```bash
# Instalar Vercel CLI
npm i -g vercel

# Fazer deploy de produção
vercel --prod
```

## CI/CD

O pipeline de integração contínua está em `.github/workflows/ci.yml` e executa automaticamente em push/PR nas branches `main` e `develop`:

1. Instala dependências do monorepo
2. Verifica tipos TypeScript (`tsc --noEmit`) em todos os pacotes
3. Compila o pacote `shared`
4. Executa testes da API (Jest)
5. Executa testes do web (Vitest)
6. Gera build de produção do web

## Convenções de Código

- **Código** (variáveis, funções, tipos): inglês
- **Comentários e JSDoc**: português BR
- **Interface (UI)**: português BR
- **Mensagens de erro da API**: português BR
- **TypeScript strict mode** em todos os pacotes — sem uso de `any`
