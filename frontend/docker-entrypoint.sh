#!/bin/sh
# Starts as root only long enough to fix ownership of the mounted uploads volume (volumes created by older versions are root-owned),
# then drops to the unprivileged "node" user for the actual web server.
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data/uploads /app/data/private/proofs
  chown -R node:node /app/data
  chmod 700 /app/data/private
  exec setpriv --reuid=node --regid=node --init-groups env HOME=/home/node "$@"
fi
exec "$@"
