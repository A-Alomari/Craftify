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

# Just start the server. Migrations are already applied to the database.
CMD ["node", "src/server.js"]
