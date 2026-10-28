FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /app/data && chown -R node:node /app/.next /app/data && chmod +x /app/docker-entrypoint.sh
# Uploaded photos live in /app/data (mount a volume). The database is MySQL, configured by DATABASE_URL.
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# The entrypoint fixes volume ownership, then runs the server as the unprivileged "node" user (not root).
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "node_modules/next/dist/bin/next", "start"]
