# STATUS.md

Обновлять в конце каждой сессии (коротко).

**Текущий этап:** 0 завершён вместе с подготовкой web/api (2026-10-20); следующий — этап 1, авторизация и права.

## Сделано
- Планирование завершено (`docs/DECISIONS.md`).
- Созданы: `pnpm-workspace.yaml`, корневой `package.json` (есть `pnpm dev`), `docker-compose.yml`, `.env.example`, `env/*.env.example`, `.gitignore`, `README.md`.
- 2026-10-20: этап 0 пройден — `apps/web` и `apps/api` созданы, `pnpm dev` поднимает инфраструктуру, api и web (подтверждено Anatoly).
- 2026-10-20: подготовка закончена и проверена Anatoly — web: `output: 'standalone'`, rewrites `/api/*` → Nest (префикс срезается), shadcn/ui (radix-nova, тема из tweakcn), next-intl (язык в cookie, без префиксов в URL); api: `@nestjs/config`, Prisma 7 (`prisma.config.ts`, клиент в `src/generated/prisma`, `PrismaService` через `@prisma/adapter-pg`), шаблонный Observe убран.
- 2026-10-20: решение Anatoly — интерфейс пока только на английском, RU и переключатель языка отложены (next-intl-каркас оставлен).
- 2026-10-17: правки по внешнему аудиту — раздельные `.env`, порты Docker на 127.0.0.1, `RefreshToken` в схеме, бэкапы в этапе 8, `ValidationPipe`+`helmet` в этапе 1, исправлены противоречия в документах.

## Дальше
1. Этап 1 — авторизация и права (`PLAN.md`, этап 1). Prisma-схема пока пустая (только generator/datasource).

## Известные проблемы / заметки
- 2026-10-20: `apps/web` создан, `pnpm dev` запускается. Ошибка Turbopack «Could not find next/package.json» была из-за вложенных `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`.git`/`node_modules` от create-next-app в `apps/web` — убраны (лежат в `_to_delete/`, можно стереть), `pnpm install` из корня.
- pnpm у Anatoly: не подтверждено. После `pnpm -v` добавить `packageManager` в корневой `package.json`.
- Mailpit без пина версии — закрепить тег при первом `docker compose pull`.
- Открытые вопросы: часовой пояс планирования (начало этапа 5), защита от двойного списания (этап 3).
