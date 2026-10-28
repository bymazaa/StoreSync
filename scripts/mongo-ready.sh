#!/bin/sh
set -eu
mongosh --quiet \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --eval "quit(db.hello().isWritablePrimary ? 0 : 1)"
