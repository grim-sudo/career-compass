FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package*.json frontend/.npmrc ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY frontend/ ./
ENV REACT_APP_API_URL=""
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5000
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY backend/ ./
COPY --from=frontend /build/build /app/frontend/build
USER node
EXPOSE 5000
CMD ["node", "server.js"]
