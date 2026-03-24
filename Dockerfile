FROM node:18-alpine

# Set the working directory to the root app folder
WORKDIR /app

# 1. Copy backend dependency manifests
COPY backend/package*.json ./backend/

# 2. Install backend dependencies
WORKDIR /app/backend
RUN npm install

# 3. Copy Prisma schema and generate the client
COPY backend/prisma ./prisma
RUN npx prisma generate

# 4. Copy backend source code
COPY backend/ ./

# 5. Copy frontend assets back to the root level
WORKDIR /app
COPY assets/ ./assets/
COPY pages/ ./pages/
COPY views/ ./views/
COPY index.html ./index.html

EXPOSE 4000

# 6. Start the server (run from the backend folder)
WORKDIR /app/backend
CMD ["node", "src/server.js"]
