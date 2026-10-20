# Админка школы английского

Контекст и решения — `CLAUDE.md`, план — `PLAN.md`.

## Первый запуск (этап 0)

Все команды — из корня проекта.

1. Проверь pnpm: `pnpm -v`. Если нет — `corepack enable` (или `npm i -g pnpm`).
2. Корневые переменные (читает только Docker Compose): `cp .env.example .env`
3. Подними Postgres и Mailpit: `docker compose up -d`
   - Postgres: `localhost:5432`, Mailpit (письма): http://localhost:8025
4. Создай приложения (один раз):
   - Фронт: `pnpm create next-app@latest apps/web` — ответы: TypeScript — да, ESLint — да, Tailwind — да, `src/` — да, App Router — да, import alias — по умолчанию.
   - Бэк: `cd apps && pnpm dlx @nestjs/cli new api --package-manager pnpm --skip-git --strict && cd ..`
5. Порт Nest: в `apps/api/src/main.ts` замени `app.listen(process.env.PORT ?? 3000)` на `app.listen(process.env.PORT ?? 4000)` (3000 занимает Next).
6. Переменные приложений (у каждого свой `.env`): `cp env/api.env.example apps/api/.env && cp env/web.env.example apps/web/.env`.
   Перед этапом 1 замени `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` в `apps/api/.env` на длинные случайные строки (`openssl rand -base64 48`).
7. Установи зависимости из корня: `pnpm install`
8. Запуск одной командой: `pnpm dev` (поднимет Docker и оба приложения). Или по отдельности: `pnpm dev:api` (http://localhost:4000) и `pnpm dev:web` (http://localhost:3000).

После шагов 1–8 напиши Claude: он добавит `output: 'standalone'`, rewrites `/api` → Nest, shadcn/ui, next-intl и Prisma.

## Остановка
`docker compose down` (данные сохраняются в томе `pgdata`; `docker compose down -v` удалит и данные).
