#!/bin/sh
set -eu
mongorestore \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --archive=/tmp/stockpilot-restore.gz \
  --gzip \
  --drop
