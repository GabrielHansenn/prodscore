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

São três arquivos, um por aplicação (nenhum vai para o Git):

| Arquivo | Para quê |
|---|---|
| `packages/api/.env` | API: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT` e `FRONTEND_URL` (endereço do site, usado no link de "Esqueci minha senha") |
| `apps/web/.env.local` | Site: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_API_URL` |
| `apps/mobile/.env` | App: `EXPO_PUBLIC_API_URL` (IP do computador, ex: `http://192.168.0.15:3333`), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` e `EXPO_PUBLIC_WEB_URL` |

Cada pasta tem um `.env.example` com o modelo.

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

## Deploy (Vercel)

Site e API ficam no mesmo projeto da Vercel: o site na raiz do domínio e a API em `/api`.
O build (`npm run build:vercel`, em `scripts/vercel-build.mjs`) usa a Build Output API: gera o site
com o Vite e empacota a API com o esbuild num arquivo só. Para testar o build localmente, rode o
mesmo comando e veja a pasta `.vercel/output`.

### Variáveis de ambiente (Settings → Environment Variables)

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | chave anon |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service role (só a API usa) |
| `FRONTEND_URL` | endereço do site, ex: `https://prodscore.vercel.app` |
| `VITE_SUPABASE_URL` | mesma URL do Supabase |
| `VITE_SUPABASE_ANON_KEY` | mesma chave anon |

`VITE_API_URL` não precisa ser definida: sem ela o site usa `/api`, que é o próprio domínio.

### Supabase

Em *Authentication → URL Configuration*, coloque o endereço do site em **Site URL** e adicione em
**Redirect URLs**:

- `https://SEU-DOMINIO/redefinir-senha` — link do e-mail de "Esqueci minha senha";
- `https://SEU-DOMINIO/email-confirmado` — link do e-mail de confirmação de cadastro (mostra se deu certo).

Para testar localmente, adicione também `http://localhost:5173/redefinir-senha` e
`http://localhost:5173/email-confirmado`. Endereço fora dessa lista é ignorado pelo Supabase, que
manda o link para o Site URL.

### Limites da Vercel

Uma requisição pode ter no máximo 4,5 MB; por isso a foto de comprovação aceita até 4 MB.

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
