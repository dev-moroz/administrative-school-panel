# Deploy

The whole stack runs in Docker Compose on any Linux host with Docker: `postgres`, a one-shot `migrate`, `api` and `web`.
Only `web` is published, on `127.0.0.1:3000`; put a reverse proxy or a tunnel with TLS in front of it. `api` and `postgres` stay internal.

## Production

1. Clone the repository and create the root `.env`:
   ```sh
   cp .env.example .env
   openssl rand -base64 48   # JWT_ACCESS_SECRET
   openssl rand -hex 24      # POSTGRES_PASSWORD: hex only, it goes into DATABASE_URL
   ```
   `WEB_ORIGIN` must be the public URL exactly, no trailing slash: otherwise every POST, login included, gets 403 `Forbidden origin`.
   Postgres applies `POSTGRES_PASSWORD` only when its volume is first created.
2. Build and start:
   ```sh
   docker compose -f docker-compose.prod.yml up --build -d
   docker compose -f docker-compose.prod.yml logs -f api   # migrations, seed, then "listening"
   curl -I http://127.0.0.1:3000
   ```
3. Point the proxy or tunnel at `http://127.0.0.1:3000`.

## Demo

The demo is the production stack with disposable data: on each deploy and nightly at 01:00 UTC the database is reset and filled with fictional students, lessons and payments.

```sh
docker compose -f docker-compose.prod.yml -f docker-compose.demo.yml up --build -d
```

`TEACHER_EMAIL` and `TEACHER_PASSWORD` are required: this is the public demo account, prefilled on the login page.
`scripts/demo-reset.sh` refuses to run without `DEMO_MODE=true`, which only the demo compose sets.

## Check after deploy

- The login page opens; admin and teacher logins work.
- In DevTools `access_token` and `refresh_token` are `HttpOnly` + `Secure`; the refresh cookie path is `/api/auth`.
- Delete `access_token` and reload: the session is restored via refresh.
- Upload a payment proof, restart `api`: the file still opens.

## Update

```sh
git fetch --tags && git checkout <tag>
docker compose -f docker-compose.prod.yml up --build -d
```

Migrations run in `migrate` before `api` starts. Prisma has no down migrations: back up the database (`pg_dump -Fc`) before updating.
