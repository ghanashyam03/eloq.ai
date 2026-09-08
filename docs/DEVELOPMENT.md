# Developer Setup & Operating Guide

## Prerequisites

- Node.js >= 20.x
- npm >= 10.x
- PostgreSQL database instance

---

## Environment Configuration

Copy `.env.example` to `.env` (or configure process environment):

```env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/englisher_dev

# Provider API Keys (Server-side only)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...

# Provider Selections
LLM_PROVIDER=openai
STT_PROVIDER=whisper
TTS_PROVIDER=openai
EMBEDDING_PROVIDER=openai

LOG_LEVEL=info
```

---

## Commands

### Development Server
```bash
npm run dev
```

### Static Type Checking
```bash
npm run typecheck
```

### Code Linting
```bash
npm run lint
```

### Unit & Integration Testing
```bash
npm run test
```
To run in watch mode:
```bash
npm run test:watch
```
To generate coverage reports:
```bash
npm run test:coverage
```

### Database Operations (Prisma)
Generate Prisma Client:
```bash
npm run db:generate
```
Push schema changes to local PostgreSQL instance:
```bash
npm run db:push
```

### Production Build Verification
```bash
npm run build
```
