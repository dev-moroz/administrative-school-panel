#!/bin/sh
# Wipes the database and uploads, then recreates the demo data. Demo stack only.
set -eu

if [ "${DEMO_MODE:-}" != "true" ]; then
  echo "demo-reset: DEMO_MODE=true is required, nothing was changed" >&2
  exit 1
fi

pnpm exec prisma migrate reset --force
find "$UPLOADS_DIR" -mindepth 1 -delete
# The volume may be created by this image; the api runs as node and must be able to write.
chown node:node "$UPLOADS_DIR"
pnpm exec prisma db seed
pnpm exec tsx prisma/demo-seed.ts
