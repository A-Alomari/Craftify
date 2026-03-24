FROM node:18-alpine

WORKDIR /app/backend

# Copy dependency manifests first (Docker cache layer)
COPY backend/package*.json ./

# Install ALL dependencies (including devDeps for prisma CLI)
RUN npm install

# Copy Prisma schema and generate the client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copy the rest of the backend source
COPY backend/ ./

EXPOSE 4000

# At runtime, fall back DIRECT_URL to DATABASE_URL if not explicitly set.
# This prevents the "Environment variable not found: DIRECT_URL" crash.
CMD ["sh", "-c", "export DIRECT_URL=${DIRECT_URL:-$DATABASE_URL} && npm run start:prod"]
