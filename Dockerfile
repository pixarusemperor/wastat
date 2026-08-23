# WaStat — single self-contained container serves the API, webhooks, and the built web UI.
# Coolify build pack: dockerfile, dockerfile_location: /Dockerfile, base_directory: /

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/ ./packages/
RUN npm run build --workspace @wastat/web

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/wastat.db
ENV STATIC_DIR=/app/public

COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev

COPY tsconfig.base.json ./
COPY --from=build /app/packages/web/dist /app/public
COPY packages/shared/ /app/packages/shared/
COPY packages/server/ /app/packages/server/

RUN mkdir -p /app/data /app/data/media

EXPOSE 3000
VOLUME /app/data
CMD ["npm", "run", "start", "--workspace", "@wastat/server"]
