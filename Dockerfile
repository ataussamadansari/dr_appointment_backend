# ---- Build stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Cloud Run injects PORT env variable (default 8080)
ENV PORT=8080
ENV NODE_ENV=production

# Storage directory for local prescriptions
RUN mkdir -p storage/prescriptions && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

CMD ["node", "src/server.js"]
