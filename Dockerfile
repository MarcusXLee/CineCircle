# Build the Vue frontend.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# Runtime: Express API serving the built site, with production dependencies only.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY CineCircle_MySQL.sql ./
COPY server ./server
COPY scripts/db.mjs ./scripts/db.mjs
COPY --from=build /app/dist ./dist
RUN mkdir .local && chown node:node .local
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1
# Create the schema and demo data on first start (existing data is kept), then serve.
CMD ["sh", "-c", "node scripts/db.mjs init && exec node server/index.mjs"]
